"""Prepare the independent loopback test stack and its private, synthetic fixture."""
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT.parent / "private" / "test"
STACK = PRIVATE / "stack"
runtime = PRIVATE / "runtime.json"
if runtime.exists():
    settings = json.loads(runtime.read_text())
    if settings.get("stripe", {}).get("mode") != "disabled" or settings.get("supabaseUrl") != "http://127.0.0.1:57321":
        raise SystemExit("Dedicated, offline test configuration required")
PRIVATE.mkdir(mode=0o700, parents=True, exist_ok=True)
target = STACK / "supabase"
target.mkdir(parents=True, exist_ok=True)
for name in ("migrations", "functions"):
    shutil.copytree(ROOT / "supabase" / name, target / name, dirs_exist_ok=True)
shutil.copyfile(ROOT / "supabase/seed.sql", target / "seed.sql")
config = (ROOT / "supabase/config.toml").read_text()
config = config.replace('project_id = "bli-stogg-pilot"', 'project_id = "bli-stogg-review-test"')
(target / "config.toml").write_text(config.replace("5632", "5732").replace("5683", "5783"))
env = {**os.environ, "NODE_ENV":"test", "DO_NOT_TRACK":"1", "SUPABASE_TELEMETRY_DISABLED":"1"}
subprocess.run(["python3", "commerce/local-stack.py", "start", "--test-stack", str(STACK)], cwd=ROOT, env=env, check=True)
status = json.loads(subprocess.check_output(["supabase", "status", "--workdir", str(STACK), "-o", "json"], env=env))
if status["API_URL"] != "http://127.0.0.1:57321":
    raise SystemExit("Unexpected test API")
if not runtime.exists():
    data = {"databaseUrl":status["DB_URL"],"supabaseUrl":status["API_URL"],"anonKey":status["ANON_KEY"],
            "serviceKey":status["SERVICE_ROLE_KEY"],"storeSlug":"bli-stogg","stripe":{"mode":"disabled"}}
    with open(os.open(runtime, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as f:
        json.dump(data,f)
# Existing test volumes receive pending migrations without resetting their fixtures.
subprocess.run(["supabase","migration","up","--local","--workdir",str(STACK)], env=env, check=True)
# local-support checks the offline mode and both test endpoints before making a client.
subprocess.run(["node","commerce/bootstrap-local.mjs"], cwd=ROOT, env=env, check=True)
