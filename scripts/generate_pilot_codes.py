#!/usr/bin/env python3
"""Generate private pilot codes and SQL containing only their HMAC hashes."""

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
GROUPS = ("A", "B", "C", "D")


def make_code() -> str:
    raw = "".join(secrets.choice(ALPHABET) for _ in range(16))
    return "-".join(raw[i:i + 4] for i in range(0, len(raw), 4))


def escape_sql(value: str) -> str:
    return value.replace("'", "''")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=10, help="number of pilot participant codes (default: 10)")
    parser.add_argument("--groups", default="A,B,C,D", help="comma-separated groups to balance, e.g. A,D")
    parser.add_argument("--batch", default="initial_4group_pilot", help="private study batch label")
    parser.add_argument("--csv", default="pilot_codes_private.csv")
    parser.add_argument("--crosswalk", help="optional private attendance-number to participant-ID mapping CSV")
    parser.add_argument("--sql", default="pilot_participants.sql")
    args = parser.parse_args()
    if args.count < 4 or args.count > 500:
        parser.error("--count must be between 4 and 500")
    groups = tuple(dict.fromkeys(part.strip().upper() for part in args.groups.split(",") if part.strip()))
    if not groups or any(group not in GROUPS for group in groups):
        parser.error("--groups must contain one or more of A,B,C,D")
    if args.count % len(groups) != 0:
        parser.error("--count must be divisible by the number of selected groups for equal allocation")
    if not args.batch or len(args.batch) > 80 or any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for ch in args.batch):
        parser.error("--batch must be 1–80 letters, digits, underscores, or hyphens")
    pepper_value = os.environ.get("PILOT_CODE_PEPPER")
    if pepper_value is None:
        pepper_value = getpass.getpass("Enter the same private PILOT_CODE_PEPPER set in Supabase: ")
    pepper = pepper_value.encode()
    if len(pepper) < 32:
        parser.error("Use a random pepper of at least 32 characters")

    assignments = [groups[i % len(groups)] for i in range(args.count)]
    secrets.SystemRandom().shuffle(assignments)
    rows = [(str(uuid.uuid4()), make_code(), group) for group in assignments]
    hashed_rows = []
    for participant_id, code, group in rows:
        normalized = code.replace("-", "").encode()
        digest = hmac.new(pepper, normalized, "sha256").hexdigest()
        hashed_rows.append((participant_id, digest, group, args.batch))

    csv_path = Path(args.csv)
    sql_path = Path(args.sql)
    crosswalk_path = Path(args.crosswalk) if args.crosswalk else None
    output_paths = (csv_path, sql_path) + ((crosswalk_path,) if crosswalk_path else ())
    for output_path in output_paths:
        if output_path.exists():
            parser.error(f"refusing to overwrite existing file: {output_path}")
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(("attendance_number", "participant_id", "participant_code", "assigned_group", "pilot_batch"))
        writer.writerows(("", participant_id, code, group, args.batch) for participant_id, code, group in rows)
    if crosswalk_path:
        with crosswalk_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(("attendance_number", "participant_id", "participant_code", "assigned_group", "pilot_batch"))
            writer.writerows(("", participant_id, code, group, args.batch) for participant_id, code, group in rows)

    values = ",\n".join(
        f"  ('{participant_id}', '{digest}', '{group}', '{batch}')"
        for participant_id, digest, group, batch in hashed_rows
    )
    sql = (
        "insert into public.pilot_participants (id, code_hash, assigned_group, pilot_batch) values\n"
        f"{values}\non conflict (code_hash) do nothing;\n"
    )
    sql_path.write_text(sql, encoding="utf-8")
    print(f"Created {args.count} codes; assignment counts: " + ", ".join(
        f"{group}={assignments.count(group)}" for group in groups
    ))
    print(f"Private learner code list: {csv_path}")
    print(f"SQL seed (hashes only): {sql_path}")
    print("Do not publish or commit the CSV, pepper, or project secret key.")


if __name__ == "__main__":
    main()
