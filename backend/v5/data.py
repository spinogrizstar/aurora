from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict


@lru_cache(maxsize=1)
def load_data_from_frontend() -> Dict[str, Any]:
    """Берём DATA из фронта, чтобы бэкенд и UI считали одинаково.

    Источник правды: frontend/data/data.json

    Почему так:
      - UI теперь разбит на несколько файлов и DATA больше не лежит в HTML
      - JSON удобно править без риска сломать разметку
    """

    base_dir = Path(__file__).resolve().parents[2]  # .../backend/v5 -> project root
    data_dir = base_dir / "frontend" / "data"
    data_json = data_dir / "data.json"
    if not data_json.exists():
        raise RuntimeError(f"Не найден файл данных: {data_json}")

    data = json.loads(data_json.read_text(encoding="utf-8"))
    core_json = data_dir / "core_packages.json"
    if core_json.exists():
        data["core_packages"] = json.loads(core_json.read_text(encoding="utf-8"))
    return data
