#!/usr/bin/env python3
"""Set a fresh pilot pepper in the linked Supabase project and create local codes."""

import argparse
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile

EXPECTED_PROJECT_REF = "yshjibfufqdaqipmkadu"
REPO_ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--supabase-cli",
        default="/private/tmp/supabase-bin/supabase",
        help="path to the Supabase CLI (default: the temporary CLI used for this pilot)",
    )
    parser.add_argument("--count", type=int, default=10)
    args = parser.parse_args()

    if not 4 <= args.count <= 500:
        parser.error("--count must be between 4 and 500")
    linked_ref_file = REPO_ROOT / "supabase" / ".temp" / "project-ref"
    try:
        linked_ref = linked_ref_file.read_text(encoding="utf-8").strip()
    except OSError:
        parser.error("Supabase project is not linked here; run supabase link first")
    if linked_ref != EXPECTED_PROJECT_REF:
        parser.error("This folder is not linked to the designated pilot project; refusing to set a secret")

    for output_name in ("pilot_codes_private.csv", "pilot_participants.sql"):
        if (REPO_ROOT / output_name).exists():
            parser.error(f"{output_name} already exists; move it securely before creating a new code set")

    cli = Path(args.supabase_cli)
    if not cli.is_file():
        parser.error(f"Supabase CLI not found: {cli}")

    pepper = secrets.token_hex(32)
    env_path = None
    try:
        fd, env_name = tempfile.mkstemp(prefix="pilot-supabase-", suffix=".env", dir="/private/tmp")
        env_path = Path(env_name)
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(f"PILOT_CODE_PEPPER={pepper}\n")

        cli_env = os.environ.copy()
        cli_env["SUPABASE_TELEMETRY_DISABLED"] = "1"
        print("Setting PILOT_CODE_PEPPER on the linked pilot project…", flush=True)
        result = subprocess.run(
            [str(cli), "secrets", "set", "--env-file", str(env_path)],
            cwd=REPO_ROOT,
            env=cli_env,
            check=False,
        )
        if result.returncode != 0:
            print("Supabase did not accept the secret. No participant codes were generated.", file=sys.stderr)
            return result.returncode

        print("Supabase accepted the secret. Generating the private code list and hash-only SQL…", flush=True)
        generator_env = os.environ.copy()
        generator_env["PILOT_CODE_PEPPER"] = pepper
        return subprocess.run(
            [sys.executable, str(REPO_ROOT / "scripts" / "generate_pilot_codes.py"), "--count", str(args.count)],
            cwd=REPO_ROOT,
            env=generator_env,
            check=False,
        ).returncode
    finally:
        if env_path is not None:
            env_path.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
