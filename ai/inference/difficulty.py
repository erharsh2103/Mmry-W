"""Difficulty inference with the trained TensorFlow model."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
import tensorflow as tf

from preprocessing.features import LEVELS, SessionRecord, build_features

TARGET_P = 0.6


@dataclass(frozen=True)
class GameHistory:
    game_type: str
    sessions: list[SessionRecord]
    baseline_area_score: float | None


@dataclass(frozen=True)
class LevelRecommendation:
    game_type: str
    level: int
    p_success: float


class DifficultyModel:
    name = "difficulty-mlp"

    def __init__(self, models_dir: Path) -> None:
        self._model = tf.keras.models.load_model(models_dir / "difficulty_model.keras", compile=False)
        self.metrics = json.loads((models_dir / "difficulty_metrics.json").read_text(encoding="utf-8"))
        self.version = str(self.metrics["version"])
        # Warm up so the first real request does not pay graph tracing.
        self._model(np.zeros((len(LEVELS), len(build_features([], None, 1))), dtype=np.float32), training=False)

    def recommend(self, games: list[GameHistory]) -> list[LevelRecommendation]:
        if not games:
            return []
        # One batched forward pass: every game x every candidate level.
        rows = [build_features(g.sessions, g.baseline_area_score, lv) for g in games for lv in LEVELS]
        probs = self._model(np.stack(rows), training=False).numpy().reshape(len(games), len(LEVELS))
        out = []
        for game, p in zip(games, probs):
            good = [i for i, pv in enumerate(p) if pv >= TARGET_P]
            idx = max(good) if good else int(np.argmax(p))
            out.append(LevelRecommendation(game_type=game.game_type, level=LEVELS[idx], p_success=round(float(p[idx]), 4)))
        return out
