from __future__ import annotations

import pytest

from preprocessing.features import FEATURE_NAMES, SessionRecord, build_features
from preprocessing.text import normalise


def test_health_reports_loaded_models(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert set(body["models"]) == {"intent", "difficulty"}


@pytest.mark.parametrize("path", ["/v1/intent", "/v1/difficulty"])
def test_inference_requires_service_token(client, path):
    assert client.post(path, json={}).status_code == 401
    assert client.post(path, json={}, headers={"authorization": "Bearer wrong"}).status_code == 401


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("When is my medicine?", "med"),
        ("मेरी दवा कब है", "med"),
        ("who is Rupa", "who"),
        ("show my family", "people"),
        ("let us play a game", "game"),
    ],
)
def test_intent_on_clear_requests(client, auth, text, expected):
    res = client.post("/v1/intent", json={"text": text, "lang": "en"}, headers=auth)
    assert res.status_code == 200
    assert res.json()["intent"] == expected


def test_intent_rejects_invalid_input(client, auth):
    assert client.post("/v1/intent", json={"text": "", "lang": "en"}, headers=auth).status_code == 422
    assert client.post("/v1/intent", json={"text": "x" * 501, "lang": "en"}, headers=auth).status_code == 422
    assert client.post("/v1/intent", json={"text": "hi", "lang": "english"}, headers=auth).status_code == 422
    assert client.post("/v1/intent", json={"text": "hi", "lang": "en", "extra": 1}, headers=auth).status_code == 422


def _history(accuracy: float, level: int, n: int = 6) -> list[dict]:
    return [{"level": level, "accuracy": accuracy, "response_ms": 4000, "attempts": 1} for _ in range(n)]


def test_difficulty_moves_with_performance(client, auth):
    body = {
        "games": [
            {"game_type": "memory-cards", "sessions": _history(1.0, 3), "baseline_area_score": 80},
            {"game_type": "pattern", "sessions": _history(0.1, 3), "baseline_area_score": 20},
        ]
    }
    res = client.post("/v1/difficulty", json=body, headers=auth)
    assert res.status_code == 200
    recs = {r["game_type"]: r["level"] for r in res.json()["recommendations"]}
    assert recs["memory-cards"] > recs["pattern"]
    assert all(1 <= lv <= 5 for lv in recs.values())


def test_difficulty_without_history_uses_baseline(client, auth):
    body = {"games": [{"game_type": "attention", "sessions": [], "baseline_area_score": None}]}
    res = client.post("/v1/difficulty", json=body, headers=auth)
    assert res.status_code == 200
    assert res.json()["recommendations"][0]["level"] in {1, 2, 3, 4, 5}


def test_difficulty_rejects_unknown_game(client, auth):
    body = {"games": [{"game_type": "chess", "sessions": []}]}
    assert client.post("/v1/difficulty", json=body, headers=auth).status_code == 422


def test_features_have_declared_shape():
    x = build_features([SessionRecord(2, 0.5, 3000, 2)], 60.0, 3)
    assert x.shape == (len(FEATURE_NAMES),)


def test_normalise_strips_indic_punctuation():
    assert normalise("  मेरी दवा कब है?। ") == "मेरी दवा कब है"
