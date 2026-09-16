"""Analytics pipeline: database -> daily metrics -> patient_daily_metrics.

    python -m data_processing.pipeline                # one run, last 90 days
    python -m data_processing.pipeline --days 30
    python -m data_processing.pipeline --loop 3600    # run every hour (docker-compose worker)

Each run is recorded in analytics_runs. Rows are upserted, so re-running is safe.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data_processing import db, extract  # noqa: E402
from data_processing.transform import METRIC_COLUMNS, build_daily_metrics  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("mmry.analytics")

UPSERT = """
INSERT INTO patient_daily_metrics
  (patient_id, day, sessions, mean_accuracy, mean_response_ms, tasks_done, tasks_total,
   engagement_score, geofence_exits, sos_count, computed_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
ON CONFLICT (patient_id, day) DO UPDATE SET
  sessions = EXCLUDED.sessions, mean_accuracy = EXCLUDED.mean_accuracy,
  mean_response_ms = EXCLUDED.mean_response_ms, tasks_done = EXCLUDED.tasks_done,
  tasks_total = EXCLUDED.tasks_total, engagement_score = EXCLUDED.engagement_score,
  geofence_exits = EXCLUDED.geofence_exits, sos_count = EXCLUDED.sos_count, computed_at = now()
"""


def _none(v):
    return None if pd.isna(v) else v


def run_once(days: int) -> dict:
    with db.postgres() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO analytics_runs DEFAULT VALUES RETURNING id")
            run_id = cur.fetchone()[0]
        conn.commit()
        try:
            metrics = build_daily_metrics(
                extract.sessions(conn, days),
                extract.daily_sessions(conn, days),
                extract.daily_routine(conn, days),
                extract.daily_safety(conn, days),
                extract.patients(conn),
            )
            rows = [tuple(_none(r[c]) for c in METRIC_COLUMNS) for _, r in metrics.iterrows()]
            with conn.cursor() as cur:
                if rows:
                    cur.executemany(UPSERT, rows)
                cur.execute(
                    """UPDATE analytics_runs SET status = 'succeeded', finished_at = now(),
                              patients_processed = %s, rows_written = %s WHERE id = %s""",
                    (int(metrics["patient_id"].nunique()) if len(metrics) else 0, len(rows), run_id),
                )
            conn.commit()
            summary = {"run_id": str(run_id), "patients": int(metrics["patient_id"].nunique()) if len(metrics) else 0, "rows": len(rows)}
            log.info(json.dumps({"msg": "analytics run succeeded", **summary}))
            return summary
        except Exception as exc:
            conn.rollback()
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE analytics_runs SET status = 'failed', finished_at = now(), message = %s WHERE id = %s",
                    (str(exc)[:2000], run_id),
                )
            conn.commit()
            raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--days", type=int, default=90)
    parser.add_argument("--loop", type=int, default=0, help="repeat every N seconds")
    args = parser.parse_args()
    while True:
        try:
            run_once(args.days)
        except Exception as exc:  # keep the worker alive; the failure is recorded in analytics_runs
            log.error(json.dumps({"msg": "analytics run failed", "error": str(exc)}))
            if not args.loop:
                raise
        if not args.loop:
            break
        time.sleep(args.loop)


if __name__ == "__main__":
    main()
