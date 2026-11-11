"""Private, machine-local binding for an existing Wreach meeting fixture."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from uuid import UUID

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[1]
PROFILE = SOURCE.parent / "privat-moteoppsett"
SDK = "local-supabase-2.112.4.js"
SDK_HASH = "4a682a365b7290cfbc6575f140cb9a11b195f6c152d9d676e2fdcc59d4608b92"
DOCKER = ["/usr/local/bin/docker", "--host", "unix://" + str(Path.home() / ".docker/run/docker.sock")]
NODE = shutil.which("node") or str(Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")
DB_PATTERN = r"wreach-membership-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}-db"


class MeetingError(Exception):
    """Diagnostics suitable for display without secret material."""


def require(condition, message):
    if not condition:
        raise MeetingError(message)


def private_location():
    os.umask(0o077)
    require(not any((p / ".git").exists() for p in [PROFILE, *PROFILE.parents]),
            "Det private oppsettet må ligge utenfor Git. Legg arbeidskopien i en separat lokal mappe.")
    require(not PROFILE.is_symlink(), "Privat profil kan ikke være en symbolsk lenke.")
    if PROFILE.exists():
        require(PROFILE.stat().st_uid == os.getuid() and PROFILE.stat().st_mode & 0o077 == 0,
                "Det private oppsettet skal eies av deg og ha modus 0700.")


def read_private(path):
    require(path.is_file() and not path.is_symlink() and path.stat().st_uid == os.getuid()
            and path.stat().st_mode & 0o077 == 0, "Privat fil mangler eller har uventede rettigheter.")
    return json.loads(path.read_bytes())


def run(args, *, data=None, cwd=None, error, timeout=25):
    try:
        result = subprocess.run(args, input=data, text=True, capture_output=True, cwd=cwd, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired):
        raise MeetingError(error) from None
    require(result.returncode == 0, error)
    return result.stdout.strip()


def validate_fixture(config, account):
    db = config["db"]
    require(re.fullmatch(DB_PATTERN, db), "Ukjent databaseidentitet.")
    prefix = db[:-3]
    ids = []
    err = "Den bundne isolerte Docker-instansen er ikke tilgjengelig. Sjekk Docker Desktop og det private oppsettet. Ingen database opprettes."
    fmt = '{{.Id}} {{.State.Running}} {{.HostConfig.NetworkMode}} {{len .HostConfig.PortBindings}} {{ index .Config.Labels "wreach.membership.exercise" }}'
    for suffix in ["-db", "-auth", "-rest"]:
        raw = run(DOCKER + ["inspect", "--format", fmt, prefix + suffix], error=err).split()
        require(len(raw) == 5 and raw[1:] == ["true", "none" if not ids else "container:" + ids[0], "0", prefix],
                "Testinstansens isolasjon eller eiermerking avviker.")
        ids.append(raw[0])
    if "containers" in config:
        require(ids == config["containers"], "Containeridentiteten har endret seg. Kontroller bindingen manuelt.")
    uid = str(UUID(account["uid"]))
    projects = [str(UUID(p)) for p in config["projects"]]
    require(len(projects) == len(set(projects)) and projects, "Ugyldig prosjektbinding.")
    sql = f"""BEGIN TRANSACTION READ ONLY;
SELECT count(*) FROM public.websites w
JOIN public.company_memberships m ON m.company_id=w.company_id
JOIN public.profiles p ON p.id=m.user_id
JOIN auth.users u ON u.id=p.id
WHERE w.id='{projects[0]}' AND u.id='{uid}' AND m.status='active' AND m.role='editor'
AND p.status='active' AND u.email LIKE '%@test.invalid' AND EXISTS
(SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=u.id AND f.factor_type='totp' AND f.status='verified');
SELECT count(*) FROM public.websites WHERE id IN ({','.join(repr(p) for p in projects)});
ROLLBACK;
"""
    rows = run(DOCKER + ["exec","-i",db,"psql","-XqAt","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],
               data=sql, error=err).splitlines()
    require(rows == ["1", str(len(projects))], "Kunne ikke bekrefte testkunden, tofaktoren og prosjektbindingen. Ingen reset utført.")
    for path in ("http://127.0.0.1:9999/health","http://127.0.0.1:3000/"):
        run(DOCKER + ["exec",db,"curl","-qfsS","--max-time","4","-o","/dev/null",path], error=err)
    return ids


def load_profile():
    private_location()
    require((PROFILE / "binding.json").is_file(), "Privat møteprofil mangler. Se engangsoppsettet i README.md. Ingen automatisk ny kunde.")
    binding = read_private(PROFILE / "binding.json")
    require((PROFILE / "account.json").is_file(), "Privat kontofil mangler. Gjenopprett account.json fra din private kopi, eller bruk den gjennomgåtte fixturen som oppgitt i README.md.")
    account = read_private(PROFILE / "account.json")
    validate_fixture(binding, account)
    require(hashlib.sha256((PROFILE / SDK).read_bytes()).hexdigest() == SDK_HASH, "Lokal SDK-cache avviker.")
    return binding
