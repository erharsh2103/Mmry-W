"""Simulated players for the difficulty model.

There is no recorded patient data to train on, so sessions are generated from
an item-response-theory model, the standard way to describe how a person of
ability theta performs on a task of difficulty b:

    P(item correct) = sigmoid(1.7 * (theta + game_offset - b_level))

Each player has a base ability, a per-game offset, and a slow drift per
session (mostly stable or declining, as expected in this population). A
session is six items; response time grows as the task gets harder relative to
the player; retries grow with errors.

Every assumption here is a modelling choice, not an observation. The model
trained on it is a principled starting point for adaptive difficulty. It
should be recalibrated once real, consented session data exists.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from preprocessing.features import LEVELS, SessionRecord

GAMES = ("object-recall", "sequence", "name-face", "attention", "memory-cards", "pattern", "find-object", "picture-recall")
ITEMS_PER_SESSION = 6
SUCCESS_ACCURACY = 0.7          # a session counts as a comfortable success at or above this
TARGET_P = 0.6                  # recommend the hardest level with P(success) at least this
LEVEL_DIFFICULTY = {level: -2.0 + 1.0 * (level - 1) for level in LEVELS}


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def success_probability(p_item: float) -> float:
    """P(accuracy >= SUCCESS_ACCURACY) for a binomial session of ITEMS_PER_SESSION items."""
    need = math.ceil(SUCCESS_ACCURACY * ITEMS_PER_SESSION - 1e-9)
    n = ITEMS_PER_SESSION
    return sum(math.comb(n, k) * p_item**k * (1 - p_item) ** (n - k) for k in range(need, n + 1))


@dataclass
class Player:
    rng: np.random.Generator
    ability: float
    drift: float
    offsets: dict[str, float]
    history: dict[str, list[SessionRecord]] = field(default_factory=dict)
    baseline: dict[str, float | None] = field(default_factory=dict)

    @classmethod
    def sample(cls, rng: np.random.Generator) -> "Player":
        player = cls(
            rng=rng,
            ability=float(rng.normal(0.0, 1.0)),
            drift=float(rng.normal(-0.01, 0.015)),
            offsets={g: float(rng.normal(0.0, 0.4)) for g in GAMES},
        )
        has_check = rng.random() < 0.7
        for g in GAMES:
            player.history[g] = []
            if has_check:
                true = 100 * sigmoid(1.7 * (player.ability + player.offsets[g]))
                player.baseline[g] = float(np.clip(true + rng.normal(0, 8), 0, 100))
            else:
                player.baseline[g] = None
        return player

    def item_probability(self, game: str, level: int) -> float:
        return sigmoid(1.7 * (self.ability + self.offsets[game] - LEVEL_DIFFICULTY[level]))

    def true_success(self, game: str, level: int) -> float:
        return success_probability(self.item_probability(game, level))

    def oracle_level(self, game: str) -> int:
        good = [lv for lv in LEVELS if self.true_success(game, lv) >= TARGET_P]
        return max(good) if good else 1

    def play(self, game: str, level: int) -> SessionRecord:
        """Simulate one session without recording it."""
        p = self.item_probability(game, level)
        correct = int(self.rng.binomial(ITEMS_PER_SESSION, p))
        gap = LEVEL_DIFFICULTY[level] - (self.ability + self.offsets[game])
        response_ms = int(np.clip(math.exp(self.rng.normal(8.3 + 0.35 * gap, 0.25)), 800, 60_000))
        attempts = 1 + int(self.rng.poisson(max(0.0, (1 - p) * 2)))
        return SessionRecord(level=level, accuracy=correct / ITEMS_PER_SESSION, response_ms=response_ms, attempts=attempts)

    def record(self, game: str, session: SessionRecord) -> None:
        self.history[game].append(session)
        self.ability += self.drift + float(self.rng.normal(0.0, 0.05))


def rule_level(history: list[SessionRecord], baseline: float | None) -> int:
    """The original app's rule, mirrored from backend/src/utils/scoring.ts."""
    if not history:
        return 1 if baseline is None else int(max(1, min(5, round(baseline / 22))))
    last = history[-1]
    if last.accuracy >= 0.8:
        return min(5, last.level + 1)
    two = history[-2:]
    if len(two) == 2 and all(s.accuracy < 0.45 for s in two):
        return max(1, last.level - 1)
    return last.level
