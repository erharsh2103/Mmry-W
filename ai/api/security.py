"""Service-to-service authentication: only the backend holds AI_SERVICE_TOKEN."""

from __future__ import annotations

import hmac

from fastapi import HTTPException, Request, status


def require_service_token(request: Request) -> None:
    expected: str = request.app.state.settings.service_token
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme != "Bearer" or not hmac.compare_digest(token.encode(), expected.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid service token")
