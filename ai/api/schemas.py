"""Request and response contracts. These must match backend/src/services/aiClient.service.ts."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

GameType = Literal["object-recall", "sequence", "name-face", "attention", "memory-cards", "pattern", "find-object", "picture-recall"]
Intent = Literal["med", "today", "who", "game", "check", "people", "unknown"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ModelInfo(Strict):
    name: str
    version: str


class IntentRequest(Strict):
    text: str = Field(min_length=1, max_length=500)
    lang: str = Field(pattern=r"^[a-z]{2,3}$")


class IntentResponse(Strict):
    intent: Intent
    confidence: float = Field(ge=0, le=1)
    model: ModelInfo


class SessionIn(Strict):
    level: int = Field(ge=1, le=5)
    accuracy: float = Field(ge=0, le=1)
    response_ms: int = Field(ge=0, le=3_600_000)
    attempts: int = Field(ge=1, le=1000)


class GameIn(Strict):
    game_type: GameType
    sessions: list[SessionIn] = Field(default_factory=list, max_length=50)
    baseline_area_score: float | None = Field(default=None, ge=0, le=100)


class DifficultyRequest(Strict):
    games: list[GameIn] = Field(min_length=1, max_length=8)


class Recommendation(Strict):
    game_type: GameType
    level: int = Field(ge=1, le=5)
    p_success: float = Field(ge=0, le=1)


class DifficultyResponse(Strict):
    recommendations: list[Recommendation]
    model: ModelInfo
