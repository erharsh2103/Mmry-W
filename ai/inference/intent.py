"""Intent inference with the trained scikit-learn pipeline."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np


@dataclass(frozen=True)
class IntentPrediction:
    intent: str
    confidence: float


class IntentClassifier:
    name = "intent-tfidf-char-logreg"

    def __init__(self, models_dir: Path) -> None:
        bundle = joblib.load(models_dir / "intent_classifier.joblib")
        self._pipeline = bundle["pipeline"]
        self._floor = float(bundle["confidence_floor"])
        self.version = str(bundle["version"])
        self.metrics = json.loads((models_dir / "intent_metrics.json").read_text(encoding="utf-8"))
        self._classes = np.asarray(self._pipeline.classes_)

    def predict(self, text: str) -> IntentPrediction:
        proba = self._pipeline.predict_proba([text])[0]
        best = int(np.argmax(proba))
        confidence = float(proba[best])
        intent = str(self._classes[best]) if confidence >= self._floor else "unknown"
        return IntentPrediction(intent=intent, confidence=round(confidence, 4))
