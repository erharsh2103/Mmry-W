# AI models

Both models are small, explainable, and have a rule-based fallback in the
backend, so the product keeps working when the AI service is down. Every call
is logged (model version, latency, fallback) in MongoDB `ai_inference_logs`.

## 1. Talk-companion intent classifier (scikit-learn)

- **Task:** map what the patient said to `med`, `today`, `who`, `game`, `check`, `people` or `unknown`.
- **Model:** character n-gram TF-IDF (1-4, `char_wb`) + logistic regression, confidence floor 0.25.
  Character n-grams handle Devanagari, Bengali, Tamil and romanised Hindi without per-language tokenizers.
- **Data:** `ai/training/data/intent_phrases.json`, 378 samples, each tagged with its source:
  Mmry's own UI strings in every language they exist, the original keyword lists, and
  hand-written English/Hindi/Hinglish templates including hard negatives ("play some music").
- **Result (5-fold stratified cross-validation):** accuracy 0.754, macro F1 0.740, against
  0.582 / 0.645 for the keyword rule it replaces, on the same text.
- **Limits:** this is curated text, not recorded patient speech, and near-duplicate phrasings can
  share folds, so real-world accuracy will be lower. The hyperparameters were chosen on the same
  folds. Full per-class results: `ai/models/intent_metrics.json`.

## 2. Adaptive difficulty model (TensorFlow)

- **Task:** for a patient's history with one game, predict P(session accuracy ≥ 0.7) at each
  level 1-5, and recommend the hardest level with P ≥ 0.6.
- **Model:** Keras MLP (13 features → 32 → 16 → 1, sigmoid). Features are built by the same
  function at training and serving time (`ai/preprocessing/features.py`).
- **Data:** there is no real patient data, so sessions come from an item-response-theory
  simulator (`ai/training/simulate_players.py`): per-player ability, per-game offsets, slow
  drift, six-item sessions. Every parameter is a modelling assumption, documented in the file.
- **Result on unseen simulated players:** AUC 0.972, Brier 0.062 (0.049 if the true
  probability were known). Share of sessions landing in the target difficulty band
  (true success 0.5-0.85): original rule 10.4%, model 24.7%, **model clamped to ±1 level of the
  rule (what the product ships) 26.8%**, oracle 40.2%.
- **Safeguard:** the backend never lets the model move more than one level from the rule.
- **Limits:** validated only against its own simulator. Recalibrate on real, consented
  session data before relying on it. Full results: `ai/models/difficulty_metrics.json`.

## Retraining

```bash
npm run ai:train      # rebuild the intent dataset, retrain both models, rewrite metrics
cd ai && .venv/bin/python -m pytest -q
```
