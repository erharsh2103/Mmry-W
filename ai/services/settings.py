"""Service configuration from the environment. Secrets have no defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

AI_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    service_token: str
    models_dir: Path
    port: int


def load_settings() -> Settings:
    token = os.environ.get("AI_SERVICE_TOKEN", "")
    if len(token) < 32 or token.startswith("CHANGE_ME"):
        raise RuntimeError("AI_SERVICE_TOKEN must be set to at least 32 random characters")
    return Settings(
        service_token=token,
        models_dir=Path(os.environ.get("AI_MODELS_DIR", AI_ROOT / "models")),
        port=int(os.environ.get("AI_SERVICE_PORT", "8000")),
    )
