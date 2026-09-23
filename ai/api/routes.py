"""HTTP endpoints. Only AI/ML work happens here: no database access, no user data storage."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from api.schemas import DifficultyRequest, DifficultyResponse, IntentRequest, IntentResponse, ModelInfo, Recommendation
from api.security import require_service_token
from inference.difficulty import GameHistory
from preprocessing.features import SessionRecord
from services.registry import ModelRegistry

router = APIRouter()


def registry(request: Request) -> ModelRegistry:
    return request.app.state.registry


@router.get("/health")
def health(request: Request) -> dict:
    return {"status": "ok", "models": registry(request).describe()}


@router.post("/v1/intent", response_model=IntentResponse, dependencies=[Depends(require_service_token)])
def classify_intent(body: IntentRequest, request: Request) -> IntentResponse:
    model = registry(request).intent
    prediction = model.predict(body.text)
    return IntentResponse(
        intent=prediction.intent,
        confidence=prediction.confidence,
        model=ModelInfo(name=model.name, version=model.version),
    )


@router.post("/v1/difficulty", response_model=DifficultyResponse, dependencies=[Depends(require_service_token)])
def recommend_difficulty(body: DifficultyRequest, request: Request) -> DifficultyResponse:
    model = registry(request).difficulty
    games = [
        GameHistory(
            game_type=g.game_type,
            sessions=[SessionRecord(s.level, s.accuracy, s.response_ms, s.attempts) for s in g.sessions],
            baseline_area_score=g.baseline_area_score,
        )
        for g in body.games
    ]
    recs = model.recommend(games)
    return DifficultyResponse(
        recommendations=[Recommendation(game_type=r.game_type, level=r.level, p_success=r.p_success) for r in recs],
        model=ModelInfo(name=model.name, version=model.version),
    )


@router.post("/v1/transcribe", dependencies=[Depends(require_service_token)])
async def transcribe_audio(
    request: Request,
    audio: UploadFile = File(...),
    lang: str = Form("en"),
) -> dict:
    if not audio.content_type or not audio.content_type.startswith("audio/"):
        from fastapi import HTTPException

        raise HTTPException(status_code=415, detail="audio/* content is required")
    data = await audio.read()
    if not data or len(data) > 10 * 1024 * 1024:
        from fastapi import HTTPException

        raise HTTPException(status_code=413, detail="audio must be between 1 byte and 10 MB")
    suffix = ".webm" if "webm" in audio.content_type else ".wav"
    text, confidence = registry(request).transcriber.transcribe(data, suffix, lang[:3])
    return {"text": text, "confidence": confidence, "model": {"name": "faster-whisper", "version": registry(request).transcriber.version}}
