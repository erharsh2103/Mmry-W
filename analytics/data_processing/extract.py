"""Read-only extraction from PostgreSQL and MongoDB into pandas frames."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd
import psycopg
from pymongo.database import Database


def _frame(conn: psycopg.Connection, sql: str, params: tuple = ()) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        cols = [c.name for c in cur.description or []]
        return pd.DataFrame(cur.fetchall(), columns=cols)


def sessions(conn: psycopg.Connection, since_days: int) -> pd.DataFrame:
    df = _frame(
        conn,
        """SELECT patient_id::text, game_type, level, accuracy::float AS accuracy, response_ms, attempts, played_at
             FROM game_sessions WHERE played_at >= now() - make_interval(days => %s)
            ORDER BY played_at""",
        (since_days + 30,),  # extra history so the 12-session window is full on the first reported day
    )
    if not df.empty:
        df["played_at"] = pd.to_datetime(df["played_at"], utc=True)
    return df


def daily_sessions(conn: psycopg.Connection, since_days: int) -> pd.DataFrame:
    return _frame(
        conn,
        """SELECT patient_id::text, day, sessions::int, mean_accuracy::float, mean_response_ms::float
             FROM v_daily_sessions WHERE day >= current_date - %s""",
        (since_days,),
    )


def daily_routine(conn: psycopg.Connection, since_days: int) -> pd.DataFrame:
    return _frame(
        conn,
        "SELECT patient_id::text, day, tasks_done::int FROM v_daily_routine WHERE day >= current_date - %s",
        (since_days,),
    )


def daily_safety(conn: psycopg.Connection, since_days: int) -> pd.DataFrame:
    return _frame(
        conn,
        """SELECT patient_id::text, day, geofence_exits::int, sos_count::int
             FROM v_daily_safety WHERE day >= current_date - %s""",
        (since_days,),
    )


def patients(conn: psycopg.Connection) -> pd.DataFrame:
    return _frame(
        conn,
        """SELECT patient_id::text, language, age, created_at, active_tasks::int, last_session_at, last_check_at
             FROM v_patient_overview""",
    )


def mind_checks(conn: psycopg.Connection, since_days: int) -> pd.DataFrame:
    return _frame(
        conn,
        """SELECT patient_id::text, taken_at, memory, attention, recognition, recall, reasoning, orientation,
                  overall, avg_response_ms, inconsistent
             FROM mind_checks WHERE taken_at >= now() - make_interval(days => %s)""",
        (since_days,),
    )


def stored_daily_metrics(conn: psycopg.Connection, since_days: int) -> pd.DataFrame:
    return _frame(
        conn,
        """SELECT patient_id::text, day, sessions, mean_accuracy::float, mean_response_ms, tasks_done, tasks_total,
                  engagement_score, geofence_exits, sos_count
             FROM patient_daily_metrics WHERE day >= current_date - %s ORDER BY day""",
        (since_days,),
    )


def pipeline_runs(conn: psycopg.Connection, limit: int = 20) -> pd.DataFrame:
    return _frame(
        conn,
        """SELECT started_at, finished_at, status, patients_processed, rows_written, message
             FROM analytics_runs ORDER BY started_at DESC LIMIT %s""",
        (limit,),
    )


def assistant_usage(db: Database, since_days: int) -> pd.DataFrame:
    """Intent counts per day. Reads only non-sensitive fields; the transcript stays encrypted and unread."""
    since = datetime.now(timezone.utc) - timedelta(days=since_days)
    rows = list(
        db["assistant_turns"].aggregate(
            [
                {"$match": {"createdAt": {"$gte": since}}},
                {
                    "$group": {
                        "_id": {
                            "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
                            "intent": "$intent",
                            "fallback": "$classifier.fallback",
                        },
                        "turns": {"$sum": 1},
                        "confidence": {"$avg": "$confidence"},
                    }
                },
            ]
        )
    )
    return pd.DataFrame(
        [{**r["_id"], "turns": r["turns"], "mean_confidence": r["confidence"]} for r in rows],
        columns=["day", "intent", "fallback", "turns", "mean_confidence"],
    )


def inference_health(db: Database, since_days: int) -> pd.DataFrame:
    since = datetime.now(timezone.utc) - timedelta(days=since_days)
    rows = list(
        db["ai_inference_logs"].aggregate(
            [
                {"$match": {"createdAt": {"$gte": since}}},
                {
                    "$group": {
                        "_id": "$task",
                        "calls": {"$sum": 1},
                        "fallbacks": {"$sum": {"$cond": ["$fallback", 1, 0]}},
                        "mean_latency_ms": {"$avg": "$latencyMs"},
                    }
                },
            ]
        )
    )
    return pd.DataFrame(
        [{"task": r["_id"], "calls": r["calls"], "fallbacks": r["fallbacks"], "mean_latency_ms": r["mean_latency_ms"]} for r in rows],
        columns=["task", "calls", "fallbacks", "mean_latency_ms"],
    )
