"""Write a cohort report as Markdown plus CSV extracts.

    python -m reports.generate_report --days 30

Output goes to reports/output/<date>/ (git-ignored). Patients appear only as
pseudonymous codes; no encrypted field is read.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from data_processing import db, extract  # noqa: E402
from models.engagement import accuracy_trend  # noqa: E402


def pseudonym(patient_id: str) -> str:
    return "P-" + hashlib.sha256(patient_id.encode()).hexdigest()[:6].upper()


def build(days: int) -> tuple[str, dict[str, pd.DataFrame]]:
    with db.postgres() as conn:
        daily = extract.stored_daily_metrics(conn, days)
        patients = extract.patients(conn)
        checks = extract.mind_checks(conn, days)
    client, mongo = db.mongo()
    try:
        inference = extract.inference_health(mongo, days)
    finally:
        client.close()

    trends = []
    for pid, group in daily.groupby("patient_id") if not daily.empty else []:
        t = accuracy_trend(group)
        trends.append(
            {
                "patient": pseudonym(pid),
                "activities": int(group["sessions"].sum()),
                "slope_pts_per_week": t.slope_per_week if t else None,
                "interval_95": f"{t.low}..{t.high}" if t else None,
                "reading": t.direction if t else "too little data",
                "geofence_exits": int(group["geofence_exits"].sum()),
                "sos": int(group["sos_count"].sum()),
            }
        )
    trend_df = pd.DataFrame(trends)

    lines = [
        f"# Mmry cohort report - last {days} days",
        "",
        f"Generated {date.today().isoformat()}. Engagement trends only - not a diagnosis.",
        "",
        "## Summary",
        "",
        f"- Patients: {len(patients)}",
        f"- Activities played: {int(daily['sessions'].sum()) if not daily.empty else 0}",
        f"- Mind checks: {len(checks)}",
        f"- Safe-zone exits: {int(daily['geofence_exits'].sum()) if not daily.empty else 0}",
        f"- SOS presses: {int(daily['sos_count'].sum()) if not daily.empty else 0}",
        "",
        "## Accuracy trend per patient",
        "",
        "A reading of *declining* or *improving* is given only when the whole 95% interval of the Theil-Sen slope agrees.",
        "",
    ]
    if trend_df.empty:
        lines.append("No daily metrics in this period.")
    else:
        lines.append("| patient | activities | pts/week | 95% interval | reading | exits | SOS |")
        lines.append("| --- | ---: | ---: | --- | --- | ---: | ---: |")
        for r in trend_df.itertuples():
            lines.append(
                f"| {r.patient} | {r.activities} | {'' if pd.isna(r.slope_pts_per_week) else r.slope_pts_per_week} "
                f"| {r.interval_95 or ''} | {r.reading} | {r.geofence_exits} | {r.sos} |"
            )
    lines += ["", "## AI service", ""]
    if inference.empty:
        lines.append("No AI calls recorded.")
    else:
        for r in inference.itertuples():
            rate = r.fallbacks / r.calls if r.calls else 0
            lines.append(f"- {r.task}: {r.calls} calls, {rate:.1%} answered by the rule fallback, mean {r.mean_latency_ms:.0f} ms")
    return "\n".join(lines) + "\n", {"daily_metrics": daily.assign(patient_id=daily["patient_id"].map(pseudonym)) if not daily.empty else daily, "trends": trend_df}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=30)
    args = parser.parse_args()
    markdown, tables = build(args.days)
    out = ROOT / "reports" / "output" / date.today().isoformat()
    out.mkdir(parents=True, exist_ok=True)
    (out / "cohort_report.md").write_text(markdown, encoding="utf-8")
    for name, frame in tables.items():
        frame.to_csv(out / f"{name}.csv", index=False)
    print(f"report written to {out}")


if __name__ == "__main__":
    main()
