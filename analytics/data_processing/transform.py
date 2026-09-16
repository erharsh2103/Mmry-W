"""Pure transformations: frames in, frames out. No I/O, so every step is unit-tested."""

from __future__ import annotations

import pandas as pd

from models.engagement import daily_engagement

METRIC_COLUMNS = [
    "patient_id",
    "day",
    "sessions",
    "mean_accuracy",
    "mean_response_ms",
    "tasks_done",
    "tasks_total",
    "engagement_score",
    "geofence_exits",
    "sos_count",
]


def build_daily_metrics(
    sessions: pd.DataFrame,
    daily_sessions: pd.DataFrame,
    daily_routine: pd.DataFrame,
    daily_safety: pd.DataFrame,
    patients: pd.DataFrame,
) -> pd.DataFrame:
    """One row per patient per day on which anything happened."""
    key = ["patient_id", "day"]
    frames = [f[key] for f in (daily_sessions, daily_routine, daily_safety) if not f.empty]
    if not frames:
        return pd.DataFrame(columns=METRIC_COLUMNS)

    days = pd.concat(frames).drop_duplicates()
    out = (
        days.merge(daily_sessions, on=key, how="left")
        .merge(daily_routine, on=key, how="left")
        .merge(daily_safety, on=key, how="left")
        .merge(patients[["patient_id", "active_tasks"]], on="patient_id", how="left")
    )

    engagement = daily_engagement(sessions).rename("engagement_score")
    if not engagement.empty:
        engagement.index = engagement.index.set_names(key)
        out = out.merge(engagement.reset_index(), on=key, how="left")
    else:
        out["engagement_score"] = pd.NA

    out["sessions"] = out["sessions"].fillna(0).astype(int)
    out["tasks_done"] = out["tasks_done"].fillna(0).astype(int)
    out["tasks_total"] = out["active_tasks"].fillna(0).astype(int)
    out["geofence_exits"] = out["geofence_exits"].fillna(0).astype(int)
    out["sos_count"] = out["sos_count"].fillna(0).astype(int)
    out["mean_accuracy"] = out["mean_accuracy"].round(3)
    out["mean_response_ms"] = out["mean_response_ms"].round().astype("Int64")
    out["engagement_score"] = out["engagement_score"].round().astype("Int64")
    return out[METRIC_COLUMNS].sort_values(key).reset_index(drop=True)
