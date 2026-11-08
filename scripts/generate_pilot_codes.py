#!/usr/bin/env python3
"""Generate private pilot codes and SQL containing only their HMAC hashes."""

import argparse
import csv
import getpass
import hmac
import os
import secrets
import string
from pathlib import Path

ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
GROUPS = ("A", "B", "C", "D")


def make_code() -> str:
    raw = "".join(secrets.choice(ALPHABET) for _ in range(16))
    return "-".join(raw[i:i + 4] for i in range(0, len(raw), 4))


def escape_sql(value: str) -> str:
    return value.replace("'", "''")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=10, help="number of pilot participant codes (default: 10)")
    parser.add_argument("--csv", default="pilot_codes_private.csv")
    parser.add_argument("--sql", default="pilot_participants.sql")
    args = parser.parse_args()
    if args.count < 4 or args.count > 500:
        parser.error("--count must be between 4 and 500")
    pepper_value = os.environ.get("PILOT_CODE_PEPPER")
    if pepper_value is None:
        pepper_value = getpass.getpass("Enter the same private PILOT_CODE_PEPPER set in Supabase: ")
    pepper = pepper_value.encode()
    if len(pepper) < 32:
        parser.error("Use a random pepper of at least 32 characters")

    assignments = [GROUPS[i % len(GROUPS)] for i in range(args.count)]
    secrets.SystemRandom().shuffle(assignments)
    rows = [(make_code(), group) for group in assignments]
    hashed_rows = []
    for code, group in rows:
        normalized = code.replace("-", "").encode()
        digest = hmac.new(pepper, normalized, "sha256").hexdigest()
        hashed_rows.append((digest, group))

    csv_path = Path(args.csv)
    sql_path = Path(args.sql)
    for output_path in (csv_path, sql_path):
        if output_path.exists():
            parser.error(f"refusing to overwrite existing file: {output_path}")
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(("participant_code", "assigned_group"))
        writer.writerows(rows)

    values = ",\n".join(f"  ('{digest}', '{group}')" for digest, group in hashed_rows)
    sql = (
        "insert into public.pilot_participants (code_hash, assigned_group) values\n"
        f"{values}\non conflict (code_hash) do nothing;\n"
    )
    sql_path.write_text(sql, encoding="utf-8")
    print(f"Created {args.count} codes; assignment counts: " + ", ".join(
        f"{group}={assignments.count(group)}" for group in GROUPS
    ))
    print(f"Private learner code list: {csv_path}")
    print(f"SQL seed (hashes only): {sql_path}")
    print("Do not publish or commit the CSV, pepper, or project secret key.")


if __name__ == "__main__":
    main()
