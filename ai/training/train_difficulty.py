"""Train the adaptive-difficulty model (TensorFlow / Keras).

The network predicts P(session accuracy >= 0.7) for a patient's history with
a game at a candidate level. The service then recommends the hardest level
whose predicted probability is at least 0.6 ("desirable difficulty").

Training data comes from training/simulate_players.py (see its docstring for
why and for every assumption). Evaluation uses players the model never saw:

  * ranking and calibration of the predicted probability (AUC, Brier), and
  * whole-episode play under four policies - the original rule, the model, the
    model clamped to one level of the rule (what the product ships),
    and an oracle that knows each player's true ability - scored by how often
    the chosen level lands in the target band of true success probability.

    python -m training.train_difficulty
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
import tensorflow as tf
from sklearn.metrics import brier_score_loss, roc_auc_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from preprocessing.features import FEATURE_NAMES, LEVELS, build_features  # noqa: E402
from training.simulate_players import (  # noqa: E402
    GAMES,
    SUCCESS_ACCURACY,
    TARGET_P,
    Player,
    rule_level,
)

MODEL = ROOT / "models" / "difficulty_model.keras"
METRICS = ROOT / "models" / "difficulty_metrics.json"

SEED = 11
TRAIN_PLAYERS = 1500
TEST_PLAYERS = 400
SESSIONS_PER_GAME = 12
EXPLORE = 0.35           # chance a simulated history uses a nearby random level, so all levels are covered
TARGET_BAND = (0.5, 0.85)


def generate(players: int, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    xs, ys, truth = [], [], []
    for _ in range(players):
        player = Player.sample(rng)
        for game in GAMES:
            for _ in range(SESSIONS_PER_GAME):
                history = player.history[game]
                baseline = player.baseline[game]
                # Counterfactual candidates: outcomes at two levels from the same state.
                for level in rng.choice(LEVELS, size=2, replace=False):
                    level = int(level)
                    outcome = player.play(game, level)
                    xs.append(build_features(history, baseline, level))
                    ys.append(1.0 if outcome.accuracy >= SUCCESS_ACCURACY else 0.0)
                    truth.append(player.true_success(game, level))
                played = rule_level(history, baseline)
                if rng.random() < EXPLORE:
                    played = int(np.clip(played + rng.choice([-1, 1]), 1, 5))
                player.record(game, player.play(game, played))
    return np.stack(xs), np.array(ys, dtype=np.float32), np.array(truth)


def build_model(n_features: int) -> tf.keras.Model:
    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(n_features,)),
            tf.keras.layers.Dense(32, activation="relu"),
            tf.keras.layers.Dropout(0.1),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1, activation="sigmoid"),
        ]
    )
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="binary_crossentropy", metrics=[tf.keras.metrics.AUC(name="auc")])
    return model


def recommend(model: tf.keras.Model, history, baseline) -> int:
    x = np.stack([build_features(history, baseline, lv) for lv in LEVELS])
    p = model(x, training=False).numpy().ravel()
    good = [lv for lv, pv in zip(LEVELS, p) if pv >= TARGET_P]
    return max(good) if good else int(LEVELS[int(np.argmax(p))])


def evaluate_policies(model: tf.keras.Model, rng: np.random.Generator, players: int) -> dict:
    results = {}
    # "model_clamped" is what the product does: the backend keeps the model
    # within one level of the rule (backend/src/services/insights.service.ts).
    for name in ("rule", "model", "model_clamped", "oracle"):
        policy_rng = np.random.default_rng(rng.integers(1 << 32))
        in_band = 0
        total = 0
        level_error = 0.0
        accuracy = 0.0
        for _ in range(players):
            player = Player.sample(policy_rng)
            for game in GAMES:
                for _ in range(SESSIONS_PER_GAME):
                    history, baseline = player.history[game], player.baseline[game]
                    if name == "rule":
                        level = rule_level(history, baseline)
                    elif name == "model":
                        level = recommend(model, history, baseline)
                    elif name == "model_clamped":
                        rule = rule_level(history, baseline)
                        level = int(np.clip(recommend(model, history, baseline), max(1, rule - 1), min(5, rule + 1)))
                    else:
                        level = player.oracle_level(game)
                    p_true = player.true_success(game, level)
                    in_band += TARGET_BAND[0] <= p_true <= TARGET_BAND[1]
                    level_error += abs(level - player.oracle_level(game))
                    session = player.play(game, level)
                    accuracy += session.accuracy
                    player.record(game, session)
                    total += 1
        results[name] = {
            "sessions": total,
            "share_in_target_band": round(in_band / total, 4),
            "mean_abs_level_error_vs_oracle": round(level_error / total, 4),
            "mean_accuracy": round(accuracy / total, 4),
        }
    return results


def main() -> None:
    tf.keras.utils.set_random_seed(SEED)
    rng = np.random.default_rng(SEED)

    x_train, y_train, _ = generate(TRAIN_PLAYERS, rng)
    x_test, y_test, p_test = generate(TEST_PLAYERS, np.random.default_rng(SEED + 1))
    print(f"train rows {len(x_train)}, test rows {len(x_test)}, positive rate {y_train.mean():.3f}")

    model = build_model(x_train.shape[1])
    model.fit(
        x_train,
        y_train,
        validation_split=0.1,
        epochs=15,
        batch_size=512,
        verbose=2,
        callbacks=[tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True)],
    )
    predicted = model(x_test, training=False).numpy().ravel()
    MODEL.parent.mkdir(parents=True, exist_ok=True)
    model.save(MODEL)

    version = datetime.now(timezone.utc).strftime("%Y%m%d") + f"-s{SEED}"
    policies = evaluate_policies(model, np.random.default_rng(SEED + 2), TEST_PLAYERS // 2)
    metrics = {
        "model": "difficulty-mlp",
        "version": version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "tensorflow_version": tf.__version__,
        "features": list(FEATURE_NAMES),
        "label": f"session accuracy >= {SUCCESS_ACCURACY}",
        "recommendation": f"hardest level with predicted P(success) >= {TARGET_P}",
        "data": {
            "source": "simulated players (training/simulate_players.py) - no real patient data",
            "train_rows": int(len(x_train)),
            "test_rows": int(len(x_test)),
            "test_players_unseen": True,
        },
        "held_out": {
            "auc": round(float(roc_auc_score(y_test, predicted)), 4),
            "brier": round(float(brier_score_loss(y_test, predicted)), 4),
            "brier_if_true_probability_known": round(float(np.mean((p_test - y_test) ** 2)), 4),
        },
        "policy_simulation": {"target_band_true_success": list(TARGET_BAND), **policies},
        "limitations": [
            "Trained and evaluated on a simulator; its item-response assumptions are modelling choices, not measurements.",
            "The backend clamps every recommendation to within one level of the original rule.",
            "Recalibrate on real, consented session data before relying on it clinically.",
        ],
    }
    METRICS.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: metrics[k] for k in ("version", "held_out", "policy_simulation")}, indent=2))


if __name__ == "__main__":
    main()
