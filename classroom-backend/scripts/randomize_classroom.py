#!/usr/bin/env python3
"""Balanced random allocation within 3x3 baseline strata; emits SQL only."""
import argparse
import csv
import random
import re
import secrets
import uuid
from collections import Counter, defaultdict
from pathlib import Path

GROUPS = ("A", "B", "C", "D")
UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="CSV exported from queries/randomization_input.sql")
    parser.add_argument("--output", default="classroom_randomization.sql")
    parser.add_argument("--expected-count", type=int, default=114)
    parser.add_argument("--seed", help="optional reproducibility seed; generated securely if omitted")
    args = parser.parse_args()
    seed = args.seed if args.seed is not None else secrets.token_hex(16)
    rng = random.Random(seed)

    people = []
    seen = set()
    with Path(args.input).open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            pid = (row.get("participant_id") or "").strip()
            if not UUID_RE.fullmatch(pid):
                parser.error(f"invalid participant_id: {pid!r}")
            if pid in seen:
                parser.error(f"duplicate participant_id: {pid}")
            seen.add(pid)
            try:
                band = int(row["music_experience_band"])
                score = float(row["baseline_mean_absolute_error"])
            except (KeyError, TypeError, ValueError):
                parser.error("CSV needs music_experience_band and baseline_mean_absolute_error columns")
            if band not in (1, 2, 3) or not 0 <= score <= 48:
                parser.error(f"out-of-range baseline fields for participant {pid}")
            people.append({"id": pid, "experience": band, "score": score})
    if args.expected_count >= 0 and len(people) != args.expected_count:
        parser.error(f"expected {args.expected_count} complete participants, found {len(people)}; resolve incomplete/missing baselines before allocation")
    if not people:
        parser.error("no participants found")

    # Split by score rank into cohort-relative thirds; shuffle ties deterministically
    # from the recorded seed so equal values do not always fall in the same third.
    tie_key = {p["id"]: rng.random() for p in people}
    ranked = sorted(people, key=lambda p: (p["score"], tie_key[p["id"]]))
    for i, person in enumerate(ranked):
        person["performance"] = min(3, (i * 3) // len(ranked) + 1)

    strata = defaultdict(list)
    for p in people:
        strata[(p["experience"], p["performance"])].append(p)
    stratum_keys = list(strata)
    rng.shuffle(stratum_keys)

    overall = Counter()
    assigned = []
    for key in stratum_keys:
        members = strata[key]
        rng.shuffle(members)
        base, remainder = divmod(len(members), 4)
        counts = {g: base for g in GROUPS}
        choices = list(GROUPS)
        rng.shuffle(choices)
        for _ in range(remainder):
            min_total = min(overall[g] + counts[g] for g in GROUPS)
            eligible = [g for g in GROUPS if overall[g] + counts[g] == min_total]
            chosen = rng.choice(eligible)
            counts[chosen] += 1
        group_list = [g for g in GROUPS for _ in range(counts[g])]
        rng.shuffle(group_list)
        for person, group in zip(members, group_list):
            assigned.append((person["id"], person["experience"], person["performance"], group))
            overall[group] += 1

    output = Path(args.output)
    if output.exists():
        parser.error(f"refusing to overwrite existing file: {output}")
    run_id = str(uuid.uuid4())
    rows = ",\n".join(
        f"  ('{pid}', '{run_id}', {experience}, {performance}, '{group}')"
        for pid, experience, performance, group in assigned
    )
    strata_definition = "experience_band: <1y/1-<3y/3+y; performance_tertile: rank thirds of mean MAE across 2 complete 10-item pretests; balanced randomized within each of 9 strata"
    sql = f"""begin;
insert into public.randomization_runs (id, algorithm_version, random_seed, strata_definition, eligible_count)
values ('{run_id}', 'balanced-strata-v1', {sql_quote(seed)}, {sql_quote(strata_definition)}, {len(assigned)});
insert into public.randomization_assignments
  (participant_id, run_id, music_experience_band, baseline_performance_tertile, assigned_group)
values
{rows};
commit;
"""
    output.write_text(sql, encoding="utf-8")
    print(f"Prepared allocation for {len(assigned)} participants; run_id={run_id}")
    print("Group totals: " + ", ".join(f"{g}={overall[g]}" for g in GROUPS))
    print("Stratum counts: " + ", ".join(f"experience={e}/performance={t}: {len(strata[(e,t)])}" for e,t in sorted(strata)))
    print(f"Review then run SQL: {output}")
    print("Keep the seed and allocation output with the dated protocol; do not change assignments manually.")


if __name__ == "__main__":
    main()
