#!/usr/bin/env python3
"""Rotate the pilot code pepper and generate a fresh balanced A/D cohort."""
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile

EXPECTED_PROJECT_REF = "yshjibfufqdaqipmkadu"
REPO_ROOT = Path(__file__).resolve().parents[1]
CLI = Path(os.environ.get("SUPABASE_CLI", "/private/tmp/supabase-bin/supabase"))
PEPPER_NAME = "PILOT_CODE_PEPPER_AD"
OUTPUTS = (
    "pilot_reset_ad_codes_private.csv",
    "pilot_reset_ad_roster_crosswalk.csv",
    "pilot_reset_ad_participants.sql",
)


def main() -> int:
    linked_ref_file = REPO_ROOT / "supabase" / ".temp" / "project-ref"
    try:
        linked_ref = linked_ref_file.read_text(encoding="utf-8").strip()
    except OSError:
        print("Supabase project is not linked here; run supabase link first.", file=sys.stderr)
        return 2
    if linked_ref != EXPECTED_PROJECT_REF:
        print("Wrong linked project; refusing to rotate codes.", file=sys.stderr)
        return 2
    if not CLI.is_file():
        print(f"Supabase CLI not found: {CLI}", file=sys.stderr)
        return 2
    if any((REPO_ROOT / name).exists() for name in OUTPUTS):
        print("A fresh-code output already exists; preserve it and do not overwrite.", file=sys.stderr)
        return 2

    pepper = secrets.token_hex(32)
    fd, env_name = tempfile.mkstemp(prefix="pilot-reset-supabase-", suffix=".env", dir="/private/tmp")
    env_path = Path(env_name)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(f"{PEPPER_NAME}={pepper}\n")
        env = os.environ.copy()
        env["SUPABASE_TELEMETRY_DISABLED"] = "1"
        print(f"Rotating {PEPPER_NAME} on the linked pilot project…", flush=True)
        result = subprocess.run([str(CLI), "secrets", "set", "--env-file", str(env_path), "--yes"], cwd=REPO_ROOT, env=env)
        if result.returncode:
            return result.returncode
        generator_env = os.environ.copy()
        generator_env["PILOT_CODE_PEPPER"] = pepper
        print("Generating ten new codes, balanced A=5 and D=5…", flush=True)
        result = subprocess.run([
            sys.executable, str(REPO_ROOT / "scripts" / "generate_pilot_codes.py"),
            "--count", "10", "--groups", "A,D", "--batch", "ad_10_pilot_reset_2026_11",
            "--csv", OUTPUTS[0], "--crosswalk", OUTPUTS[1], "--sql", OUTPUTS[2],
        ], cwd=REPO_ROOT, env=generator_env).returncode
        if result == 0:
            for name in OUTPUTS:
                (REPO_ROOT / name).chmod(0o600)
        return result
    finally:
        env_path.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
