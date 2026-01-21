# ФАЙЛ: api_routes.py
# ЗАЧЕМ НУЖЕН:
#   Принимает ответы клиента и возвращает результат расчёта.

from fastapi import APIRouter, Request, Body
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
from pathlib import Path
from datetime import datetime
from io import BytesIO
from urllib.parse import quote
from .models.input import ChecklistInput
from .models.output import ChecklistResult
from .rules.cashbox import calculate_cashbox
from .rules.support import calculate_support
from .packages.selector import select_package

# v5 (красивый UI) расчёт
from .v5.models import V5Input, V5Result
from .v5.calc import calculate_v5
from .v5.docx_gen import build_docx_bytes, suggest_filename
from .v5.data import load_data_from_frontend
from .admin_utils import require_admin, allow_admin_page

from pathlib import Path
import json
import difflib


def _append_admin_diff_log(project_dir: Path, request: Request, old_text: str, new_text: str) -> None:
    """Пишем лог изменений data.json.

    Формат: timestamp + IP + unified diff.
    Это нужно, чтобы было понятно «когда/что/кем» меняли, даже если
    правки делались через админку без Git.

    Лог: ./logs/data_changes.log
    """

    try:
        if old_text == new_text:
            return

        logs_dir = project_dir / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        log_path = logs_dir / "data_changes.log"

        client = request.client.host if request.client else ""
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        diff = "\n".join(
            difflib.unified_diff(
                old_text.splitlines(),
                new_text.splitlines(),
                fromfile="data.json (before)",
                tofile="data.json (after)",
                lineterm="",
            )
        )

        with log_path.open("a", encoding="utf-8") as f:
            f.write("\n" + "=" * 90 + "\n")
            f.write(f"[{stamp}] ip={client} path=/api/admin/data\n")
            f.write(diff + "\n")
    except Exception:
        # Логи не должны ломать админку.
        pass

router = APIRouter()

@router.post("/calculate", response_model=ChecklistResult)
def calculate(data: ChecklistInput):
    total_points = 0
    works = []

    points, cashbox_works = calculate_cashbox(data.cashboxes)
    total_points += points
    works.extend(cashbox_works)

    if data.support:
        points, support_works = calculate_support()
        total_points += points
        works.extend(support_works)

    package = select_package(total_points)

    return ChecklistResult(
        complexity_points=total_points,
        package_name=package,
        works=works
    )


@router.post("/api/v5/calculate", response_model=V5Result)
def calculate_ui_v5(data: V5Input):
    """Расчёт для демо-UI v5 (тот самый красивый HTML)."""
    return calculate_v5(data)


@router.post("/api/v5/docx")
def export_docx(data: V5Input):
    """Скачать Word (.docx) по текущему состоянию чек-листа."""
    res = calculate_v5(data)
    payload = build_docx_bytes(data, res)
    buf = BytesIO(payload)
    filename = suggest_filename(data)

    # Параллельно сохраняем копию рядом с проектом — чтобы можно было
    # автоматически складывать ЛТ/КП в папку без ручного «Скачать».
    # Папка: ./output
    try:
        out_dir = Path(__file__).resolve().parent.parent / "output"
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = filename.replace("/", "_").replace("\\", "_")
        out_path = out_dir / f"{stamp}__{safe_name}"
        out_path.write_bytes(payload)
    except Exception:
        # Если нет прав на запись — просто продолжаем отдавать файл в браузер.
        pass
    # ВАЖНО: Starlette кодирует заголовки как latin-1, поэтому
    # Content-Disposition должен быть ASCII. Для русских букв
    # используем RFC5987 (percent-encoding) через quote(...).
    # Дополнительно даём ASCII fallback filename="KP_Aurora.docx".
    quoted = quote(filename, safe='')
    headers = {
        "Content-Disposition": f"attachment; filename=\"KP_Aurora.docx\"; filename*=UTF-8''{quoted}"
    }
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers,
    )


# -----------------------------
# Админка: правка цен/пакетов из браузера
# -----------------------------


@router.get("/admin")
def admin_page(request: Request):
    """Открывает простую страницу редактирования data.json."""
    # Страницу можно открыть «сразу», токен вводится внутри UI.
    # Поэтому тут проверяем только что админка включена и IP разрешён.
    allow_admin_page(request)
    # Path(__file__) = .../backend/api_routes.py
    # parents[1] = корень проекта (папка, где лежат backend/ и frontend/)
    project_dir = Path(__file__).resolve().parents[1]
    admin_html = project_dir / "frontend" / "admin.html"
    return FileResponse(admin_html)


@router.get("/api/admin/data")
def admin_get_data(request: Request):
    require_admin(request)
    # Возвращаем то, что использует и UI, и бэкенд.
    return load_data_from_frontend()


@router.put("/api/admin/data")
def admin_put_data(request: Request, payload: dict = Body(...)):
    """Сохраняет новый data.json (принимаем JSON целиком)."""
    require_admin(request)

    project_dir = Path(__file__).resolve().parents[1]
    data_json = project_dir / "frontend" / "data" / "data.json"

    # Минимальная валидация, чтобы случайно не сохранить мусор.
    if not isinstance(payload, dict):
        return {"ok": False, "error": "payload must be an object"}
    # В актуальной версии данные лежат в payload.segments (а не packages).
    if "segments" not in payload:
        return {"ok": False, "error": "missing key: segments"}

    # Старый текст нужен, чтобы сохранить diff в logs/data_changes.log
    old_text = ""
    try:
        old_text = data_json.read_text(encoding="utf-8")
    except Exception:
        old_text = ""

    new_text = json.dumps(payload, ensure_ascii=False, indent=2)

    data_json.write_text(new_text, encoding="utf-8")
    _append_admin_diff_log(project_dir, request, old_text, new_text)
    # Сбрасываем кеш данных, чтобы расчёты сразу увидели изменения.
    load_data_from_frontend.cache_clear()
    return {"ok": True}
