#!/usr/bin/env python3
"""Create a privacy-preserving allocation chart from the local pilot crosswalk.

Only aggregated group counts are written. Participant codes, attendance numbers,
and participant IDs are never included in the figure or output CSV.
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path

import matplotlib.pyplot as plt


GROUPS = ("A", "B", "C", "D")
COLORS = {"A": "#287a68", "B": "#5279a8", "C": "#bd7945", "D": "#8a6598"}


def count_groups(crosswalk: Path) -> Counter[str]:
    counts: Counter[str] = Counter()
    with crosswalk.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames or "assigned_group" not in reader.fieldnames:
            raise ValueError("CSVに assigned_group 列がありません。")
        for row in reader:
            group = (row.get("assigned_group") or "").strip().upper()
            if group in GROUPS:
                counts[group] += 1
            elif group:
                raise ValueError(f"想定外の群ラベルです: {group}")
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "pilot_ad_roster_crosswalk.csv",
        help="学校内で管理する対応表CSV（初期値: pilot_ad_roster_crosswalk.csv）",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "pilot_group_allocation.png",
        help="出力PNGの保存先",
    )
    args = parser.parse_args()

    counts = count_groups(args.input)
    labels = [group for group in GROUPS if counts[group] > 0]
    if not labels:
        raise SystemExit("有効な参加者行がありません。")
    values = [counts[group] for group in labels]
    total = sum(values)

    plt.rcParams["font.family"] = [
        "Hiragino Sans",
        "Yu Gothic",
        "Noto Sans CJK JP",
        "DejaVu Sans",
    ]
    fig, ax = plt.subplots(figsize=(8.2, 4.8), dpi=180)
    fig.patch.set_facecolor("#f7f6f2")
    ax.set_facecolor("#f7f6f2")

    bars = ax.barh(
        labels,
        values,
        color=[COLORS[group] for group in labels],
        height=0.48,
        zorder=3,
    )
    ax.invert_yaxis()
    ax.set_xlim(0, max(values) * 1.35 + 0.2)
    ax.set_xlabel("割り当て人数（人）", labelpad=12, color="#39443f")
    ax.set_title("パイロット参加者の群割り当て", loc="left", pad=18,
                 fontsize=17, fontweight="medium", color="#20342d")
    ax.text(0, 1.035, f"合計 {total} 人  ·  出席番号や参加者IDを含まない集計",
            transform=ax.transAxes, fontsize=10, color="#66736d")
    ax.xaxis.grid(True, color="#dce2dd", linewidth=0.8, zorder=0)
    ax.set_axisbelow(True)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.spines["bottom"].set_color("#bfc9c2")
    ax.tick_params(axis="y", length=0, labelsize=12, colors="#263b33", pad=12)
    ax.tick_params(axis="x", length=0, labelsize=9, colors="#66736d", pad=8)
    ax.set_xticks(range(0, max(values) + 2))

    for bar, value in zip(bars, values):
        ax.text(value + 0.12, bar.get_y() + bar.get_height() / 2,
                f"{value}人", va="center", fontsize=12,
                fontweight="medium", color="#263b33")

    fig.text(0.99, 0.025, "割付人数の図。学習成績・効果を示すものではありません。",
             ha="right", fontsize=8.5, color="#66736d")
    fig.subplots_adjust(left=0.14, right=0.93, top=0.78, bottom=0.18)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(args.output, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)
    print(f"集計人数: {', '.join(f'{group}={counts[group]}' for group in labels)} (計{total}人)")
    print(f"保存先: {args.output}")


if __name__ == "__main__":
    main()
