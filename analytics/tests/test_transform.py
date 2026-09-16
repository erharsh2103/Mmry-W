from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data_processing.transform import METRIC_COLUMNS, build_daily_metrics  # noqa: E402
from models.engagement import accuracy_trend, engagement_score  # noqa: E402


def test_engagement_matches_backend_formula():
    # Same session the backend scored as 71 during API verification.
    one = pd.DataFrame([{"accuracy": 0.8, "attempts": 2, "response_ms": 5200}])
    assert engagement_score(one) == 71


def test_engagement_empty_is_none():
    assert engagement_score(pd.DataFrame(columns=["accuracy", "attempts", "response_ms"])) is None


def test_engagement_uses_last_twelve_sessions():
    old_bad = [{"accuracy": 0.0, "attempts": 5, "response_ms": 30000}] * 20
    recent_good = [{"accuracy": 1.0, "attempts": 1, "response_ms": 1500}] * 12
    assert engagement_score(pd.DataFrame(old_bad + recent_good)) == 100


def _daily(values: list[float]) -> pd.DataFrame:
    start = date(2026, 1, 1)
    return pd.DataFrame({"day": [start + timedelta(days=i) for i in range(len(values))], "mean_accuracy": values})


def test_trend_detects_clear_decline():
    trend = accuracy_trend(_daily([0.9, 0.85, 0.8, 0.74, 0.7, 0.66, 0.6, 0.55]))
    assert trend is not None and trend.direction == "declining"


def test_trend_noise_reads_steady():
    trend = accuracy_trend(_daily([0.7, 0.72, 0.69, 0.71, 0.7, 0.68, 0.72, 0.7]))
    assert trend is not None and trend.direction == "steady"


def test_trend_needs_five_days():
    assert accuracy_trend(_daily([0.5, 0.6, 0.7])) is None


def test_build_daily_metrics_joins_all_sources():
    pid = "11111111-1111-1111-1111-111111111111"
    d1, d2 = date(2026, 3, 1), date(2026, 3, 2)
    played = datetime(2026, 3, 1, 10, tzinfo=timezone.utc)
    sessions = pd.DataFrame(
        [{"patient_id": pid, "game_type": "pattern", "level": 2, "accuracy": 0.8, "response_ms": 5200, "attempts": 2, "played_at": played}]
    )
    sessions["played_at"] = pd.to_datetime(sessions["played_at"], utc=True)
    daily_sessions = pd.DataFrame([{"patient_id": pid, "day": d1, "sessions": 1, "mean_accuracy": 0.8, "mean_response_ms": 5200.0}])
    daily_routine = pd.DataFrame([{"patient_id": pid, "day": d1, "tasks_done": 3}, {"patient_id": pid, "day": d2, "tasks_done": 1}])
    daily_safety = pd.DataFrame([{"patient_id": pid, "day": d2, "geofence_exits": 1, "sos_count": 1}])
    patients = pd.DataFrame([{"patient_id": pid, "active_tasks": 6}])

    out = build_daily_metrics(sessions, daily_sessions, daily_routine, daily_safety, patients)

    assert list(out.columns) == METRIC_COLUMNS
    assert len(out) == 2
    first, second = out.iloc[0], out.iloc[1]
    assert (first["sessions"], first["tasks_done"], first["tasks_total"], first["engagement_score"]) == (1, 3, 6, 71)
    assert (second["sessions"], second["geofence_exits"], second["sos_count"]) == (0, 1, 1)
    assert pd.isna(second["mean_accuracy"])


def test_build_daily_metrics_with_no_activity():
    empty = pd.DataFrame(columns=["patient_id", "day"])
    out = build_daily_metrics(pd.DataFrame(), empty, empty, empty, pd.DataFrame(columns=["patient_id", "active_tasks"]))
    assert out.empty


@pytest.mark.parametrize("value", [0.0, 1.0])
def test_engagement_bounds(value):
    frame = pd.DataFrame([{"accuracy": value, "attempts": 1, "response_ms": 1500}] * 3)
    assert 0 <= engagement_score(frame) <= 100
