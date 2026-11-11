#!/usr/bin/env python3
"""Start the local meeting or print the URL of this profile's existing server."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
from http.client import HTTPConnection
from urllib.parse import urlsplit
from profile_store import (HERE, SOURCE, PROFILE, NODE, SDK, MeetingError,
                           load_profile, require, run)


def prepare(target):
    # The ordinary build cleans its dist. Run that build only inside this fresh scratch tree.
    base = target / "source"
    base.mkdir()
    for name in ["js","css","assets","deploy/cloudflare"]:
        shutil.copytree(SOURCE / name, base / name)
    for f in [*SOURCE.glob("*.html"), SOURCE / "scripts/build-production.sh",
              SOURCE / "tests/security/static_production_artifact.sh"]:
        dest = base / f.relative_to(SOURCE)
        dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(f,dest)
    run(["bash",str(base/"scripts/build-production.sh")],error="Ordinært bygg eller artifact-kontroll feilet.")
    public = base / "dist"
    hashes = json.loads((HERE / 'baseline.json').read_text())
    for name, digest in hashes.items():
        require(hashlib.sha256((public/name).read_bytes()).hexdigest()==digest,
                "Demooverlegget passer ikke til kildefilen " + name)
    run(["/usr/bin/patch","-f","-F","0","-p1","-i",str(HERE/"builder-local.patch")],cwd=public,
        error="Kunne ikke bruke det gjennomgåtte lokale Builder-/SDK-overlegget.")
    shutil.copytree(HERE/"frontend",public,dirs_exist_ok=True)
    shutil.copyfile(PROFILE/SDK,public/"js/vendor"/SDK)
    return public


def start():
    binding = load_profile()
    run([NODE,str(HERE/"private-signin.cjs"),str(PROFILE)],error="Kunne ikke klargjøre den private innloggingen.")
    lock = (PROFILE/"server.lock").open("a")
    try:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:
        try:
            url=json.loads((PROFILE/"origins.json").read_text())['portal']
            address=urlsplit(url)
            require(address.scheme=='http' and address.hostname=='127.0.0.1' and address.port and url==f'http://127.0.0.1:{address.port}',"Uventet lokal adresse.")
            conn=HTTPConnection('127.0.0.1',address.port,timeout=2)
            try:
                conn.request('GET','/meeting/ready')
                res=conn.getresponse()
                require(res.status==200 and json.load(res)=={'instance':binding['instance']}, "Låst oppsett, men feil møteinstans.")
            finally:
                conn.close()
            print("Portalen kjører allerede:",url+"/login.html")
            print("Privat innloggingsark:",PROFILE/"Innlogging.html")
            return
        except (OSError,ValueError,KeyError):
            raise MeetingError("En start pågår. Prøv den samme kommandoen igjen om et øyeblikk.") from None
    # Rebuild a demo-only view. Published files and ordinary dist are never edited.
    with tempfile.TemporaryDirectory(prefix="wreach-mote-bygg-") as tmp:
        public=prepare(Path(tmp))
        import subprocess
        import signal
        # The child owns both listeners; terminate only this child on launcher shutdown.
        proc=subprocess.Popen([sys.executable,"-B",str(HERE/"server.py"),str(public)])
        def stop(signum,frame):
            if proc.poll() is None:
                proc.terminate()
        signal.signal(signal.SIGTERM,stop)
        try:
            rc=proc.wait()
        except KeyboardInterrupt:
            stop(None,None)
            rc=proc.wait()
        require(rc in (0,-signal.SIGTERM,-signal.SIGINT),"Den lokale demoserveren stoppet med feil.")


if __name__=="__main__":
    try:
        start()
    except MeetingError as error:
        raise SystemExit(str(error))
    except (ValueError,KeyError,TypeError,OSError):
        raise SystemExit("Lokalt møteoppsett kunne ikke leses. Se README.md. Ingen database-reset er utført.") from None
