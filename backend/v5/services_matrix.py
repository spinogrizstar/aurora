from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List


@lru_cache(maxsize=1)
def load_services_matrix() -> Dict[str, Any]:
    base_dir = Path(__file__).resolve().parents[2]
    matrix_path = base_dir / "frontend_shared" / "data" / "manager_matrix_v5.json"
    if not matrix_path.exists():
        raise RuntimeError(f"Не найден файл матрицы услуг: {matrix_path}")
    return json.loads(matrix_path.read_text(encoding="utf-8"))


def get_package_preset(package_id: str) -> Dict[str, Any]:
    matrix = load_services_matrix()
    packages = matrix.get("packages") or []
    services = matrix.get("services") or []
    groups = matrix.get("groups") or []
    normalized = str(package_id or "").strip()
    package = next((p for p in packages if str(p.get("id") or "") == normalized), None)
    preset_services = [svc for svc in services if str(svc.get("package_id") or "") == normalized]
    return {
        "rate_per_hour": matrix.get("rate_per_hour", 4950),
        "package": package,
        "groups": groups,
        "services": preset_services,
    }


def list_packages() -> List[Dict[str, Any]]:
    matrix = load_services_matrix()
    return matrix.get("packages") or []
