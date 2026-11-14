#!/usr/bin/env python3
"""Add a separate A/D 5+5 pilot batch without replacing the original code pepper."""

import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile

EXPECTED_PROJECT_REF = "yshjibfufqdaqipmkadu"
REPO_ROOT = Path(__file__).resolve().parents[1]
CODE_FILE = "pilot_ad_codes_private.csv"
ROSTER_FILE = "pilot_ad_roster_crosswalk.csv"
SQL_FILE = "pilot_ad_participants.sql"
PEPPER_NAME = "PILOT_CODE_PEPPER_AD"
BATCH_NAME = "ad_10_pilot_2026_11"


def main() -> int:
    cli = Path(os.environ.get("SUPABASE_CLI", "/private/tmp/supabase-bin/supabase"))
    linked_ref_file = REPO_ROOT / "supabase" / ".temp" / "project-ref"
    try:
        linked_ref = linked_ref_file.read_text(encoding="utf-8").strip()
    except OSError:
        print("Supabase project is not linked here; run supabase link first.", file=sys.stderr)
        return 2
    if linked_ref != EXPECTED_PROJECT_REF:
        print("Wrong linked project; refusing to add codes.", file=sys.stderr)
        return 2
    if not cli.is_file():
        print(f"Supabase CLI not found: {cli}", file=sys.stderr)
        return 2
    for name in (CODE_FILE, ROSTER_FILE, SQL_FILE):
        if (REPO_ROOT / name).exists():
            print(f"Refusing to overwrite {name}; preserve the existing private files.", file=sys.stderr)
            return 2

    pepper = secrets.token_hex(32)
    env_path = None
    try:
        fd, env_name = tempfile.mkstemp(prefix="pilot-ad-supabase-", suffix=".env", dir="/private/tmp")
        env_path = Path(env_name)
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(f"{PEPPER_NAME}={pepper}\n")
        cli_env = os.environ.copy()
        cli_env["SUPABASE_TELEMETRY_DISABLED"] = "1"
        print(f"Adding {PEPPER_NAME} without changing the existing PILOT_CODE_PEPPER…", flush=True)
        result = subprocess.run(
            [str(cli), "secrets", "set", "--env-file", str(env_path)],
            cwd=REPO_ROOT,
            env=cli_env,
            check=False,
        )
        if result.returncode != 0:
            return result.returncode

        print("Secret accepted. Creating 10 local A/D codes and hash-only SQL…", flush=True)
        generator_env = os.environ.copy()
        generator_env["PILOT_CODE_PEPPER"] = pepper
        return subprocess.run(
            [
                sys.executable, str(REPO_ROOT / "scripts" / "generate_pilot_codes.py"),
                "--count", "10", "--groups", "A,D", "--batch", BATCH_NAME,
                "--csv", CODE_FILE, "--sql", SQL_FILE,
                "--crosswalk", ROSTER_FILE,
            ],
            cwd=REPO_ROOT,
            env=generator_env,
            check=False,
        ).returncode
    finally:
        if env_path is not None:
            env_path.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
