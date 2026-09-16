from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

TOKEN = "t" * 40


@pytest.fixture(scope="session")
def client():
    import os

    os.environ["AI_SERVICE_TOKEN"] = TOKEN
    from fastapi.testclient import TestClient

    from main import create_app

    with TestClient(create_app()) as c:
        yield c


@pytest.fixture()
def auth() -> dict[str, str]:
    return {"authorization": f"Bearer {TOKEN}"}
