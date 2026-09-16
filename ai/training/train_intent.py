"""Train the talk-companion intent classifier (scikit-learn).

Character n-gram TF-IDF + logistic regression. Character n-grams work across
Devanagari, Bengali, Tamil and romanised Hindi without a tokenizer per
language, and they tolerate the misspellings speech recognition produces.

Evaluation is stratified 5-fold cross-validation on the dataset, reported next
to the keyword rule it replaces, so the comparison is on identical text.

    python -m training.train_intent
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from preprocessing.text import normalise  # noqa: E402
from training.build_intent_dataset import KEYWORDS  # noqa: E402

DATA = ROOT / "training" / "data" / "intent_phrases.json"
MODEL = ROOT / "models" / "intent_classifier.joblib"
METRICS = ROOT / "models" / "intent_metrics.json"

# Below this probability the prediction is reported as "unknown".
CONFIDENCE_FLOOR = 0.25
SEED = 7


def make_pipeline() -> Pipeline:
    return Pipeline(
        [
            ("tfidf", TfidfVectorizer(analyzer="char_wb", ngram_range=(1, 4), sublinear_tf=True, min_df=1, preprocessor=normalise)),
            ("clf", LogisticRegression(C=8.0, max_iter=4000, class_weight="balanced", random_state=SEED)),
        ]
    )


def keyword_rule(text: str) -> str:
    low = f" {text.lower()} "
    for intent, words in KEYWORDS.items():
        if any(w in low for w in words):
            return intent
    return "unknown"


def apply_floor(proba: np.ndarray, classes: np.ndarray) -> list[str]:
    best = proba.argmax(axis=1)
    return [classes[i] if proba[row, i] >= CONFIDENCE_FLOOR else "unknown" for row, i in enumerate(best)]


def main() -> None:
    raw = DATA.read_bytes()
    samples = json.loads(raw)["samples"]
    texts = [s["text"] for s in samples]
    labels = np.array([s["intent"] for s in samples])

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    proba = cross_val_predict(make_pipeline(), texts, labels, cv=cv, method="predict_proba")
    classes = np.array(sorted(set(labels)))
    predicted = apply_floor(proba, classes)
    rule = [keyword_rule(t) for t in texts]

    model = make_pipeline().fit(texts, labels)
    MODEL.parent.mkdir(parents=True, exist_ok=True)
    version = datetime.now(timezone.utc).strftime("%Y%m%d") + "-" + hashlib.sha256(raw).hexdigest()[:8]
    joblib.dump({"pipeline": model, "confidence_floor": CONFIDENCE_FLOOR, "version": version}, MODEL)

    metrics = {
        "model": "intent-tfidf-char-logreg",
        "version": version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "sklearn_version": sklearn.__version__,
        "dataset": {"path": "training/data/intent_phrases.json", "samples": len(samples),
                    "per_intent": {c: int((labels == c).sum()) for c in classes}},
        "evaluation": "stratified 5-fold cross-validation on the dataset above",
        "confidence_floor": CONFIDENCE_FLOOR,
        "model_cv": {
            "accuracy": round(accuracy_score(labels, predicted), 4),
            "macro_f1": round(f1_score(labels, predicted, average="macro"), 4),
        },
        "keyword_rule_same_text": {
            "accuracy": round(accuracy_score(labels, rule), 4),
            "macro_f1": round(f1_score(labels, rule, average="macro"), 4),
        },
        "per_class": classification_report(labels, predicted, output_dict=True, zero_division=0),
        "limitations": [
            "Curated UI strings, keywords and templates - not recorded patient speech.",
            "Chip and conversation phrases exist only in English and Hindi; other languages contribute labels such as task and screen names.",
            "Cross-validation folds can share near-duplicate phrasings across languages, so real-world accuracy will be lower.",
            "C=8 and the 0.25 confidence floor were chosen on these same folds, which flatters the figure slightly.",
        ],
    }
    METRICS.write_text(json.dumps(metrics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: metrics[k] for k in ("version", "dataset", "model_cv", "keyword_rule_same_text")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
