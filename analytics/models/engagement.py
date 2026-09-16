"""Engagement and trend statistics used by the pipeline, reports and dashboard.

`engagement_score` mirrors backend/src/utils/scoring.ts exactly, so the daily
figure the pipeline stores matches what a caregiver sees in the app. Both are
engagement trends, not a diagnosis.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.stats import theilslopes

WINDOW = 12


def engagement_score(sessions: pd.DataFrame) -> int | None:
    """0-100 over the last 12 sessions. Expects columns accuracy, attempts, response_ms, ordered oldest first."""
    r = sessions.tail(WINDOW)
    if r.empty:
        return None
    acc = float(r["accuracy"].mean())
    recall = float(np.where(r["attempts"] <= 1, 1.0, 1.0 / r["attempts"]).mean())
    speed = float(np.clip(1 - (r["response_ms"] - 1500) / 9000, 0, 1).mean())
    cons = 1 - min(1.0, math.sqrt(float(((r["accuracy"] - acc) ** 2).mean())) * 1.6)
    # Round half away from zero, like JavaScript's Math.round for positive values.
    return int(math.floor((0.4 * acc + 0.25 * recall + 0.2 * speed + 0.15 * cons) * 100 + 0.5))


def daily_engagement(sessions: pd.DataFrame) -> pd.Series:
    """Engagement score as of the end of each day that had play, per patient.

    `sessions` needs patient_id, played_at (tz-aware), accuracy, attempts, response_ms.
    Returns a Series indexed by (patient_id, day).
    """
    if sessions.empty:
        return pd.Series(dtype="float64")
    out: dict[tuple[str, object], int | None] = {}
    ordered = sessions.sort_values("played_at")
    for patient_id, group in ordered.groupby("patient_id", sort=False):
        days = group["played_at"].dt.tz_convert("UTC").dt.date
        for day in sorted(days.unique()):
            out[(patient_id, day)] = engagement_score(group[days <= day])
    return pd.Series(out, dtype="float64")


@dataclass(frozen=True)
class Trend:
    slope_per_week: float
    low: float
    high: float
    points: int

    @property
    def direction(self) -> str:
        """'declining' or 'improving' only when the whole 95% interval agrees; otherwise 'steady'."""
        if self.high < 0:
            return "declining"
        if self.low > 0:
            return "improving"
        return "steady"


def accuracy_trend(daily: pd.DataFrame, min_points: int = 5) -> Trend | None:
    """Robust (Theil-Sen) slope of daily mean accuracy, in accuracy points per week.

    Theil-Sen tolerates the odd bad day far better than least squares, which
    matters for a population whose performance varies with sleep and mood.
    """
    d = daily.dropna(subset=["mean_accuracy"]).sort_values("day")
    if len(d) < min_points:
        return None
    x = pd.to_datetime(d["day"]).map(pd.Timestamp.toordinal).to_numpy(dtype=float)
    y = d["mean_accuracy"].to_numpy(dtype=float) * 100
    slope, _, low, high = theilslopes(y, x, 0.95)
    return Trend(slope_per_week=round(slope * 7, 2), low=round(low * 7, 2), high=round(high * 7, 2), points=len(d))
