"""Bind only Bli Støgg's Docker ports to IPv4 loopback and verify actual mappings."""
import argparse
import http.client
import json
import os
from pathlib import Path
import socket
import subprocess
import time
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
PORTS = {"db": ("5432/tcp", "22"), "kong": ("8000/tcp", "21"), "inbucket": ("8025/tcp", "24")}


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def info(name):
    return json.loads(docker("container", "inspect", name))[0]


def bindings(container, internal, port):
    mappings = container["NetworkSettings"]["Ports"].get(internal) or []
    only_requested = all(not values or key == internal for key, values in container["NetworkSettings"]["Ports"].items())
    return (only_requested and any(m["HostIp"] == "127.0.0.1" for m in mappings) and all(
        m["HostPort"] == port and m["HostIp"] in ("127.0.0.1", "::1") for m in mappings))


def create(name, spec):
    endpoint = os.getenv("DOCKER_HOST") or docker("context", "inspect", "--format", '{{(index .Endpoints "docker").Host}}')
    if not endpoint.startswith("unix:///"):
        raise ValueError("Local Docker socket required")
    conn = http.client.HTTPConnection("localhost")
    conn.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    conn.sock.connect(endpoint[7:])
    try:
        conn.request("POST", "/containers/create?name=" + quote(name), json.dumps(spec), {"Content-Type": "application/json"})
        response = conn.getresponse()
        if response.status != 201:
            raise ValueError("Could not create local container, HTTP " + str(response.status))
    finally:
        conn.close()


def copy_path(source, dest, path):
    # Transfer locally between retained containers. No keys pass through files or logs.
    parent = str(Path(path).parent)
    with subprocess.Popen(["docker", "cp", "-a", source + ":" + path, "-"], stdout=subprocess.PIPE) as src:
        subprocess.run(["docker", "cp", "-a", "-", dest + ":" + parent], stdin=src.stdout, check=True)
        if src.wait() != 0:
            raise ValueError("Failed to copy container configuration")


def rebind(project, service, port, internal):
    name = "supabase_" + service + "_" + project
    original = info(name)
    if bindings(original, internal, port):
        return
    if original["Config"]["Labels"].get("com.supabase.cli.project") != project:
        raise ValueError("Unexpected container label")
    network, = original["NetworkSettings"]["Networks"]
    endpoint = original["NetworkSettings"]["Networks"][network]
    hc = original["HostConfig"]
    if set(hc["PortBindings"]) != {internal} or hc["PortBindings"][internal][0]["HostPort"] != port:
        raise ValueError("Unexpected port configuration")
    if service == "db" and not any(m.get("Name") == name and m["Destination"] == "/var/lib/postgresql/data" for m in original["Mounts"]):
        raise ValueError("Expected existing named data volume")
    hc["PortBindings"][internal] = [{"HostIp": "127.0.0.1", "HostPort": port}]
    aliases = endpoint.get("Aliases") or []
    backup = name + "-before-loopback"
    if backup in docker("ps", "-a", "--format", "{{.Names}}").splitlines():
        raise ValueError("An earlier recovery container exists: " + backup)
    # Keep the original intact until its replacement is healthy. Never remove volumes.
    docker("stop", name)
    docker("rename", name, backup)
    created = False
    try:
        spec = {**original["Config"], "Image": original["Image"], "HostConfig": hc,
                "NetworkingConfig": {"EndpointsConfig": {network: {"Aliases": aliases, "IPAMConfig": {"IPv4Address": endpoint["IPAddress"]}}}}}
        # CLI networks can use automatic IPAM. In that case Docker chooses the IP.
        if not endpoint.get("IPAMConfig"):
            spec["NetworkingConfig"]["EndpointsConfig"][network].pop("IPAMConfig")
        create(name, spec)
        created = True
        paths = {"db": ["/etc/postgresql-custom", "/etc/postgresql", "/etc/postgresql.schema.sql"],
                 "kong": ["/home/kong"], "inbucket": []}[service]
        for path in paths:
            copy_path(backup, name, path)
        docker("start", name)
        for _ in range(90):
            current = info(name)
            if current["State"].get("Health", {}).get("Status") == "healthy" and bindings(current, internal, port):
                break
            time.sleep(1)
        else:
            raise ValueError("Replacement failed its binding or health check")
    except BaseException:
        if created:
            docker("rm", "-f", name)
        docker("rename", backup, name)
        docker("start", name)
        raise
    docker("rm", backup)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["start", "verify", "rebind"])
    parser.add_argument("--test-stack", type=Path)
    args = parser.parse_args()
    engine = os.getenv("DOCKER_HOST") or docker("context", "inspect", "--format", '{{(index .Endpoints "docker").Host}}')
    if not engine.startswith("unix:///"):
        raise SystemExit("This operation requires a local Docker socket")
    project, prefix, root = ("bli-stogg-review-test", "573", args.test_stack) if args.test_stack else ("bli-stogg-pilot", "563", ROOT)
    if ('project_id = "' + project + '"') not in (root / "supabase/config.toml").read_text().splitlines():
        raise ValueError("Wrong project")
    names = set(docker("ps", "--format", "{{.Names}}").splitlines())
    core_running = all("supabase_" + service + "_" + project in names for service in
                       ("db","kong","inbucket","auth","rest","pg_meta"))
    if args.action == "start" and not core_running:
        folder = ROOT.parent / "private" / ("test" if args.test_stack else "")
        folder.mkdir(mode=0o700, exist_ok=True)
        with open(os.open(folder / "supabase-start.log", os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600), "w") as log:
            subprocess.run(["node", "--input-type=module", "-e",
                            "import {startLocalSupabase} from './commerce/local-docker.mjs'; await startLocalSupabase(process.argv[1],process.argv[2],1)",
                            str(root), project], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)
    for service, (internal, suffix) in PORTS.items():
        port = prefix + suffix
        if args.action == "rebind":
            rebind(project, service, port, internal)
        c = info("supabase_" + service + "_" + project)
        if not c["State"]["Running"] or not bindings(c, internal, port):
            raise SystemExit("Unsafe or missing binding for " + service + ". Run rebind for this project.")
        print(service, json.dumps(c["NetworkSettings"]["Ports"][internal]))


if __name__ == "__main__":
    main()
