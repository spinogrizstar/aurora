"""ФАЙЛ: backend/admin_utils.py

Небольшие утилиты для "админки" (страница изменения цен).

ЗАЧЕМ
  Хотим менять frontend/data/data.json из браузера, но безопасно.

ЗАЩИТА (простая, но рабочая)
  1) Должна быть задана переменная окружения AURORA_ADMIN_TOKEN
  2) По умолчанию доступ только с localhost (127.0.0.1 / ::1)
     Если надо разрешить из локалки — поставь:
       AURORA_ADMIN_ALLOW_LAN=1

КАК ПЕРЕДАВАТЬ ТОКЕН
  Либо заголовком:
    X-Aurora-Admin: <token>
  Либо query параметром:
    ?token=<token>
"""

from __future__ import annotations

import os
import secrets
from fastapi import Request, HTTPException


def _is_localhost(host: str) -> bool:
    return host in ("127.0.0.1", "::1", "localhost")


def require_admin(request: Request) -> None:
    """Проверка доступа к админке."""
    token_required = os.getenv("AURORA_ADMIN_TOKEN")
    if not token_required:
        # Если токен не задан — админку считаем выключенной.
        raise HTTPException(status_code=403, detail="Admin is disabled (AURORA_ADMIN_TOKEN not set)")

    allow_lan = os.getenv("AURORA_ADMIN_ALLOW_LAN", "0") in ("1", "true", "yes")
    client_host = (request.client.host if request.client else "")
    if not allow_lan and not _is_localhost(client_host):
        raise HTTPException(status_code=403, detail="Admin is allowed only from localhost")

    provided = request.headers.get("X-Aurora-Admin") or request.query_params.get("token") or ""
    if not secrets.compare_digest(provided, token_required):
        raise HTTPException(status_code=401, detail="Bad admin token")


def allow_admin_page(request: Request) -> None:
    """Проверка для открытия HTML-страницы /admin.

    Важно: страницу хочется открывать «сразу», а токен вводить уже внутри UI.
    Поэтому тут НЕ проверяем сам токен, только:
      1) что админка включена (AURORA_ADMIN_TOKEN задан)
      2) что доступ разрешён с этого IP (localhost либо LAN разрешён)
    """

    token_required = os.getenv("AURORA_ADMIN_TOKEN")
    if not token_required:
        raise HTTPException(status_code=403, detail="Admin is disabled (AURORA_ADMIN_TOKEN not set)")

    allow_lan = os.getenv("AURORA_ADMIN_ALLOW_LAN", "0") in ("1", "true", "yes")
    client_host = (request.client.host if request.client else "")
    if not allow_lan and not _is_localhost(client_host):
        raise HTTPException(status_code=403, detail="Admin is allowed only from localhost")
