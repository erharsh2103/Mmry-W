"""Feature construction for the difficulty model.

One row describes a patient's history with one game plus a candidate level.
The same function is used by the simulator (training) and the API (serving),
so the model never sees features computed two different ways.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

HISTORY = 8
LEVELS = (1, 2, 3, 4, 5)

FEATURE_NAMES = (
    "n_sessions",
    "has_history",
    "mean_accuracy",
    "last_accuracy",
    "accuracy_slope",
    "mean_level",
    "last_level",
    "log_mean_response_ms",
    "mean_first_try",
    "baseline_score",
    "has_baseline",
    "candidate_level",
    "candidate_minus_last",
)


@dataclass(frozen=True)
class SessionRecord:
    level: int
    accuracy: float
    response_ms: int
    attempts: int


def build_features(history: list[SessionRecord], baseline_score: float | None, candidate_level: int) -> np.ndarray:
    """Return a float32 vector in FEATURE_NAMES order. Values are roughly unit-scaled."""
    recent = history[-HISTORY:]
    n = len(recent)
    has_baseline = baseline_score is not None
    baseline = (baseline_score / 100.0) if has_baseline else 0.0

    if n:
        acc = np.array([s.accuracy for s in recent], dtype=np.float64)
        levels = np.array([s.level for s in recent], dtype=np.float64)
        mean_acc = float(acc.mean())
        last_acc = float(acc[-1])
        slope = float(np.polyfit(np.arange(n), acc, 1)[0]) if n >= 2 else 0.0
        mean_level = float(levels.mean())
        last_level = float(levels[-1])
        log_rt = float(np.mean([math.log1p(max(0, s.response_ms)) for s in recent]))
        first_try = float(np.mean([1.0 if s.attempts <= 1 else 1.0 / s.attempts for s in recent]))
    else:
        # No play yet: fall back to what the mind check suggests.
        mean_acc = last_acc = baseline if has_baseline else 0.5
        slope = 0.0
        mean_level = last_level = float(max(1, min(5, round((baseline * 100) / 22)))) if has_baseline else 1.0
        log_rt = math.log1p(5000)
        first_try = 0.5

    return np.array(
        [
            n / HISTORY,
            1.0 if n else 0.0,
            mean_acc,
            last_acc,
            slope,
            mean_level / 5.0,
            last_level / 5.0,
            log_rt / 10.0,
            first_try,
            baseline,
            1.0 if has_baseline else 0.0,
            candidate_level / 5.0,
            (candidate_level - last_level) / 4.0,
        ],
        dtype=np.float32,
    )
