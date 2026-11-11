"""One-time attachment to the reviewed isolated fixture. No database writes."""
import argparse
import hashlib
import json
from pathlib import Path
import os
import secrets
import shutil
import tempfile
from profile_store import (MeetingError, PROFILE, SDK, SDK_HASH, private_location,
                           read_private, require, validate_fixture)


def configure(reference):
    private_location()
    src = json.loads((reference / "evidence/fixture.json").read_bytes())
    owned = read_private(Path(src["privateDir"]) / "fixtures.json")
    account = {key: owned[0][key] for key in ("uid","email","password","seed")}
    require(account['email'].endswith('@test.invalid'), "Forventet en syntetisk lokal testidentitet.")
    config = {key: src[key] for key in ("db","projects")}
    config['containers'] = validate_fixture(config, account)
    sdk = reference / 'public/js/vendor' / SDK
    require(hashlib.sha256(sdk.read_bytes()).hexdigest() == SDK_HASH, "Feil offline-SDK.")
    if PROFILE.exists():
        stored = read_private(PROFILE / "binding.json")
        require(all(stored.get(k) == v for k,v in config.items()), "Denne profilen er allerede bundet til en annen fixture.")
        # Only restore a missing private account file. Never replace an existing credential.
        target = PROFILE / "account.json"
        if target.exists():
            require(read_private(target) == account, "Eksisterende privat oppsett avviker.")
        else:
            with target.open("x") as out:
                json.dump(account, out)
        return
    config['instance'] = secrets.token_hex(12)
    temp = Path(tempfile.mkdtemp(prefix='.moteprofil-', dir=PROFILE.parent))
    try:
        (temp/'account.json').write_text(json.dumps(account))
        (temp/'binding.json').write_text(json.dumps(config))
        shutil.copyfile(sdk,temp/SDK)
        os.rename(temp,PROFILE)
    finally:
        if temp.exists():
            shutil.rmtree(temp)


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("reference",type=Path)
    try:
        configure(parser.parse_args().reference.resolve())
        print("Det private oppsettet er klart.")
    except MeetingError as error:
        raise SystemExit(str(error))
    except (KeyError,OSError,ValueError,IndexError):
        raise SystemExit("Kilden til privat oppsett mangler eller er ugyldig. Gjenopprett en privat kopi for den samme testkunden. Ingen konto eller faktor er endret.") from None
