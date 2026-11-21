#!/usr/bin/env python3
"""Create unassigned classroom participant codes and hash-only seed SQL."""
import argparse
import csv
import getpass
import hmac
import os
import secrets
import string
import uuid
from pathlib import Path

ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def make_code() -> str:
    raw = "".join(secrets.choice(ALPHABET) for _ in range(16))
    return "-".join(raw[i:i + 4] for i in range(0, 16, 4))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=114)
    parser.add_argument("--csv", default="classroom_codes_private.csv")
    parser.add_argument("--sql", default="classroom_participants_seed.sql")
    args = parser.parse_args()
    if not 4 <= args.count <= 500:
        parser.error("--count must be between 4 and 500")
    pepper = os.environ.get("CLASSROOM_CODE_PEPPER")
    if pepper is None:
        pepper = getpass.getpass("Enter the same private CLASSROOM_CODE_PEPPER set in the classroom project: ")
    if len(pepper) < 32:
        parser.error("Use a random pepper of at least 32 characters")

    rows = [(str(uuid.uuid4()), make_code()) for _ in range(args.count)]
    hashes = [
        (participant_id, hmac.new(pepper.encode(), code.replace("-", "").encode(), "sha256").hexdigest())
        for participant_id, code in rows
    ]
    csv_path, sql_path = Path(args.csv), Path(args.sql)
    for path in (csv_path, sql_path):
        if path.exists():
            parser.error(f"refusing to overwrite existing file: {path}")

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(("attendance_number_private", "participant_id", "participant_code"))
        writer.writerows(("", participant_id, code) for participant_id, code in rows)

    values = ",\n".join(f"  ('{pid}', '{digest}')" for pid, digest in hashes)
    sql_path.write_text(
        "insert into public.participants (id, code_hash) values\n" + values +
        "\non conflict (code_hash) do nothing;\n",
        encoding="utf-8",
    )
    print(f"Created {args.count} unassigned codes.")
    print(f"Private distribution/crosswalk file: {csv_path}")
    print(f"Hash-only participant seed SQL: {sql_path}")
    print("Fill attendance_number_private only in the private file. Never commit it or the pepper.")


if __name__ == "__main__":
    main()
