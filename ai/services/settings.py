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
    whisper_model: str
    whisper_device: str
    whisper_compute_type: str
    whisper_beam_size: int


def load_settings() -> Settings:
    token = os.environ.get("AI_SERVICE_TOKEN", "")
    if len(token) < 32 or token.startswith("CHANGE_ME"):
        raise RuntimeError("AI_SERVICE_TOKEN must be set to at least 32 random characters")
    return Settings(
        service_token=token,
        models_dir=Path(os.environ.get("AI_MODELS_DIR", AI_ROOT / "models")),
        port=int(os.environ.get("AI_SERVICE_PORT", "8000")),
        # "small" is the smallest model that reliably hears "at 5 pm" rather than
        # "add 5 pm"; "base" is the fallback when the host is too slow for it.
        whisper_model=os.environ.get("WHISPER_MODEL", "small"),
        whisper_device=os.environ.get("WHISPER_DEVICE", "cpu"),
        whisper_compute_type=os.environ.get("WHISPER_COMPUTE_TYPE", "int8"),
        whisper_beam_size=int(os.environ.get("WHISPER_BEAM_SIZE", "5")),
    )
