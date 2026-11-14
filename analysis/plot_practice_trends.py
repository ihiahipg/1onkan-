#!/usr/bin/env python3
"""Plot aggregate practice-set metrics from the privacy-minimized Supabase query."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import matplotlib.pyplot as plt


COLORS = {"A": "#287a68", "D": "#8a6598", "B": "#5279a8", "C": "#bd7945"}


def read_rows(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError("CSVに練習データがありません。")
    required = {
        "assigned_group", "practice_set", "participants_contributing",
        "participants_also_in_previous_set", "mean_absolute_error_semitones",
        "mean_exact_accuracy", "mean_target_crossings_per_question",
        "mean_time_to_target_ms",
    }
    missing = required.difference(rows[0])
    if missing:
        raise ValueError(f"必要な列がありません: {', '.join(sorted(missing))}")
    return rows


def plot(rows: list[dict], output: Path, batch_label: str) -> None:
    plt.rcParams["font.family"] = ["Hiragino Sans", "Yu Gothic", "Noto Sans CJK JP", "DejaVu Sans"]
    fig, axes = plt.subplots(2, 2, figsize=(11, 7.2), dpi=180, sharex=True)
    fig.patch.set_facecolor("#f7f6f2")
    panels = [
        ("mean_absolute_error_semitones", "平均絶対誤差", "半音", lambda v: v, "小さいほど誤差が小さい"),
        ("mean_exact_accuracy", "完全正答率", "%", lambda v: v * 100, "大きいほど正答が多い"),
        ("mean_target_crossings_per_question", "対象音を跨いだ平均回数", "回／問", lambda v: v, "単独では良し悪しを判断できない"),
        ("mean_time_to_target_ms", "目標音に合わせるまでの平均時間", "秒", lambda v: v / 1000, "正確さとの両方で見る"),
    ]

    for ax, (field, title, unit, convert, note) in zip(axes.flat, panels):
        ax.set_facecolor("#f7f6f2")
        ax.grid(axis="y", color="#dce2dd", linewidth=0.8, zorder=0)
        ax.spines[["top", "right"]].set_visible(False)
        ax.spines["left"].set_color("#bfc9c2")
        ax.spines["bottom"].set_color("#bfc9c2")
        ax.tick_params(length=0, colors="#66736d", pad=6)
        ax.set_title(title, loc="left", fontsize=12, fontweight="medium", color="#20342d", pad=10)
        ax.set_ylabel(unit, color="#39443f")

        for group in sorted({row["assigned_group"] for row in rows}):
            series = sorted(
                (row for row in rows if row["assigned_group"] == group),
                key=lambda row: int(row["practice_set"]),
            )
            xs = [int(row["practice_set"]) for row in series]
            ys = [convert(float(row[field])) for row in series]
            color = COLORS.get(group, "#666666")

            # Connect adjacent means only if the entire contributing sample repeated.
            for i in range(1, len(series)):
                same_sample = (
                    int(series[i]["participants_also_in_previous_set"]) == int(series[i]["participants_contributing"])
                    and int(series[i - 1]["participants_contributing"]) == int(series[i]["participants_contributing"])
                )
                if same_sample and int(series[i]["practice_set"]) == int(series[i - 1]["practice_set"]) + 1:
                    ax.plot(xs[i - 1:i + 1], ys[i - 1:i + 1], color=color, linewidth=2, zorder=2)

            ax.scatter(xs, ys, s=54, color=color, edgecolor="#f7f6f2", linewidth=1.2,
                       label=f"{group}群", zorder=3)
            for x, y, row in zip(xs, ys, series):
                n = int(row["participants_contributing"])
                label = f"{y:.2f}  (n={n})" if field != "mean_exact_accuracy" else f"{y:.0f}%  (n={n})"
                ax.annotate(label, (x, y), xytext=(5, 7), textcoords="offset points",
                            fontsize=8.5, color="#263b33")
        ax.set_xticks(sorted({int(row["practice_set"]) for row in rows}))
        ax.set_xlabel("練習セット（1セット＝10問）", color="#39443f")
        ax.text(0, -0.34, note, transform=ax.transAxes, fontsize=8.5, color="#66736d")

    handles, labels = axes.flat[0].get_legend_handles_labels()
    fig.legend(handles, labels, loc="upper right", frameon=False, ncol=max(1, len(labels)))
    fig.suptitle("練習中の指標の推移（暫定）", x=0.08, y=0.98, ha="left",
                 fontsize=17, fontweight="medium", color="#20342d")
    fig.text(0.08, 0.93,
             f"{batch_label} · Supabase集計 · 各点は参加者ごとの平均を群内で平均 · 表示範囲は現在の記録分のみ",
             fontsize=9, color="#66736d")
    fig.text(0.08, 0.025,
             "注意：各点の人数が少なく、群間の効果比較には使えません。練習項目も群間で同一とは限りません。",
             fontsize=9, color="#7a5144")
    fig.subplots_adjust(left=0.09, right=0.96, top=0.86, bottom=0.15, hspace=0.55, wspace=0.28)
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    default_input = Path(__file__).resolve().parent / "practice_snapshot_2026-11-10.csv"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=default_input, help="集計CSV（practice_trends.sqlの結果）")
    parser.add_argument(
        "--output", type=Path,
        default=Path(__file__).resolve().parent / "practice_session_trends_2026-11-10.png",
        help="PNG出力先",
    )
    parser.add_argument("--batch", default="A/D 10人パイロット", help="図に表示するデータ範囲")
    args = parser.parse_args()
    plot(read_rows(args.input), args.output, args.batch)
    print(f"グラフを保存しました: {args.output}")


if __name__ == "__main__":
    main()
