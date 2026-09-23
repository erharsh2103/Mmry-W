"""Loads each model once at startup and hands the same instance to every request."""

from __future__ import annotations

from dataclasses import dataclass

from inference.difficulty import DifficultyModel
from inference.intent import IntentClassifier
from inference.transcription import Transcriber
from services.settings import Settings


@dataclass
class ModelRegistry:
    intent: IntentClassifier
    difficulty: DifficultyModel
    transcriber: Transcriber

    @classmethod
    def load(cls, settings: Settings) -> "ModelRegistry":
        return cls(
            intent=IntentClassifier(settings.models_dir),
            difficulty=DifficultyModel(settings.models_dir),
            transcriber=Transcriber(
                settings.whisper_model,
                settings.whisper_device,
                settings.whisper_compute_type,
                settings.whisper_beam_size,
            ),
        )

    def describe(self) -> dict[str, dict[str, str]]:
        return {
            "intent": {"name": self.intent.name, "version": self.intent.version},
            "difficulty": {"name": self.difficulty.name, "version": self.difficulty.version},
            "transcription": {"name": self.transcriber.name, "version": self.transcriber.version},
        }
