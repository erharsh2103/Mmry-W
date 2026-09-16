"""Mmry AI service.

Internal only: the backend is its sole caller, authenticated with
AI_SERVICE_TOKEN. It serves two trained models and stores nothing.

    python main.py                  # 127.0.0.1:8000
    uvicorn main:app --port 8000
"""

from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI  # noqa: E402

from api.routes import router  # noqa: E402
from services.registry import ModelRegistry  # noqa: E402
from services.settings import load_settings  # noqa: E402

logging.basicConfig(level=logging.INFO, format='{"time":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}')
log = logging.getLogger("mmry.ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    app.state.settings = settings
    app.state.registry = ModelRegistry.load(settings)
    log.info("models loaded: %s", app.state.registry.describe())
    yield


def create_app() -> FastAPI:
    # No interactive docs in production: this API is not meant to be explored.
    docs = os.environ.get("NODE_ENV") != "production"
    app = FastAPI(
        title="Mmry AI service",
        version="2.0.0",
        lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs else None,
    )
    app.include_router(router)
    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("AI_SERVICE_HOST", "127.0.0.1"), port=int(os.environ.get("AI_SERVICE_PORT", "8000")))
