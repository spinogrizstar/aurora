# ФАЙЛ: main.py
# ЗАЧЕМ НУЖЕН:
#   Это точка входа в сервер.
#   Здесь мы запускаем FastAPI и подключаем маршруты.
#
# v7.6.23
#   Разделили фронтенд на модули:
#     /         — выбор (Менеджер / Клиент / Админ)
#     /client   — клиентский UI
#     /manager  — менеджерский UI (свои ассеты)
#     /admin    — админка (свои ассеты)
#     /data     — общие данные (data.json)

from pathlib import Path
import os
import secrets
import base64
import mimetypes

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi import Request
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse

from .api_routes import router

app = FastAPI(title="Aurora Checklist")
app.include_router(router)

# -----------------------------
# MIME-типы для модульных скриптов
# -----------------------------
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")

# -----------------------------
# Опциональная защита паролем (BasicAuth)
# -----------------------------
AUTH_USER = os.getenv("AURORA_USER")
AUTH_PASS = os.getenv("AURORA_PASS")


def _check_basic_auth(request: Request) -> bool:
    if not AUTH_USER or not AUTH_PASS:
        return True
    hdr = request.headers.get("authorization") or ""
    if not hdr.lower().startswith("basic "):
        return False
    try:
        raw = base64.b64decode(hdr.split(" ", 1)[1]).decode("utf-8")
        user, pwd = raw.split(":", 1)
    except Exception:
        return False
    return secrets.compare_digest(user, AUTH_USER) and secrets.compare_digest(pwd, AUTH_PASS)


@app.middleware("http")
async def basic_auth_middleware(request: Request, call_next):
    # /health оставим без пароля, чтобы удобно проверять, что сервер жив.
    if request.url.path == "/health":
        return await call_next(request)

    if not _check_basic_auth(request):
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized"},
            headers={"WWW-Authenticate": "Basic"},
        )
    return await call_next(request)


# -----------------------------
# Отключаем агрессивный кэш для статики (полезно при частых пересборках)
# -----------------------------
@app.middleware("http")
async def no_cache_static(request: Request, call_next):
    response = await call_next(request)
    p = request.url.path
    if (
        p.startswith("/data/")
        or "/assets/" in p
        or p.endswith(".html")
        or p in ("/", "/client", "/client/", "/manager", "/manager/", "/admin", "/admin/")
    ):
        response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


# -----------------------------
# Статика и маршруты модулей
# -----------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_ROOT_DIR = BASE_DIR / "frontend_root"
FRONTEND_CLIENT_DIR = BASE_DIR / "frontend_client"
FRONTEND_MANAGER_DIR = BASE_DIR / "frontend_manager"
FRONTEND_ADMIN_DIR = BASE_DIR / "frontend_admin"
DATA_DIR = BASE_DIR / "frontend_shared" / "data"

# Общие данные
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

# Модули (каждый со своими ассетами)
app.mount("/client", StaticFiles(directory=FRONTEND_CLIENT_DIR, html=True), name="client")
app.mount("/manager", StaticFiles(directory=FRONTEND_MANAGER_DIR, html=True), name="manager")
app.mount("/admin", StaticFiles(directory=FRONTEND_ADMIN_DIR, html=True), name="admin")


@app.get("/client")
def client_redirect():
    return RedirectResponse(url="/client/", status_code=307)


@app.get("/manager")
def manager_redirect():
    return RedirectResponse(url="/manager/", status_code=307)


@app.get("/admin")
def admin_redirect(request: Request):
    from .admin_utils import allow_admin_page

    allow_admin_page(request)
    return RedirectResponse(url="/admin/", status_code=307)


@app.get("/")
def landing():
    return FileResponse(FRONTEND_ROOT_DIR / "index.html")


@app.get("/health")
def health():
    return {"status": "ok"}
