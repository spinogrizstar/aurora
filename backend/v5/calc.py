from __future__ import annotations

from typing import Any, Dict, List, Tuple

from .data import load_data_from_frontend
from .models import (
    CalcBlock,
    CostsBlock,
    LicenseItem,
    PackageBlock,
    ServiceItem,
    V5Input,
    V5Result,
)


def _points_to_rub(points: int, rub_per_point: int) -> int:
    """Переводим "баллы сложности" в рубли.

    В UI пользователь выбирает галочки. Каждая галочка добавляет баллы.
    Потом баллы умножаются на коэффициент rub_per_point.
    """
    return int(points) * int(rub_per_point)


def _kkt_count(state: V5Input) -> int:
    """Сколько ККТ добавили в UI (в v7 это список, а не число)."""
    return len(state.kkt or [])


def _device_counts(state: V5Input) -> Tuple[int, int]:
    """Сколько устройств: (сканеры, ТСД).

    В старых версиях было "количество". Сейчас UI может хранить список устройств.
    На всякий случай считаем из списка, чтобы бэк был совместим с разными UI.
    """
    scanners = 0
    tsd = 0
    for d in (state.devices or []):
        if (d.type or '').lower() == 'tsd':
            tsd += 1
        else:
            scanners += 1
    return scanners, tsd


def _need_diagnostics(state: V5Input) -> bool:
    """Нужна ли диагностика ККТ как отдельная услуга.

    По твоему последнему решению: НЕТ.
    ККТ можно оставить 0, и никаких доп.услуг/баннеров не появляется.
    Если когда-нибудь захочешь вернуть диагностику:
      - верни логику: (state.uses_kkt == True) и (len(state.kkt) == 0)
      - и в UI включи модалку.
    """
    return False


def _seg_flags(state: V5Input) -> Tuple[bool, bool, bool]:
    """Какие сегменты выбрал пользователь."""
    segs = state.segments or []
    low = [s.lower() for s in segs]
    is_retail = any('розниц' in s for s in low)
    is_wholesale = any('опт' in s for s in low)
    is_producer = any('производ' in s for s in low)
    return is_retail, is_wholesale, is_producer


def _calc_services_and_licenses(state: V5Input, data: Dict[str, Any]) -> Tuple[List[ServiceItem], List[LicenseItem], int, int, int]:
    """Считаем "доп.услуги" (в баллах) и "лицензии" (в рублях).

    Возвращаем:
      - service_items: список услуг с баллами
      - lic_items: список лицензий/ПО с рублями
      - points: сумма баллов
      - rub: стоимость услуг = points * rub_per_point
      - lic_rub: сумма лицензий в рублях

    ВАЖНО ДЛЯ ПРАВОК:
      - Сколько баллов даёт каждая опция — см. DATA.points_model в frontend/index.html
      - rub_per_point тоже лежит в DATA
    """
    pm = data['points_model']
    rub_per_point = int(data['rub_per_point'])

    service_items: List[ServiceItem] = []
    lic_items: List[LicenseItem] = []

    def add_svc(label: str, pts: int) -> None:
        if pts > 0:
            service_items.append(ServiceItem(label=label, pts=int(pts)))

    def add_lic(label: str, rub: int) -> None:
        if rub > 0:
            lic_items.append(LicenseItem(label=label, rub=int(rub)))

    # --- ККТ ---
    kkt_count = _kkt_count(state)
    extra_kkt = max(0, kkt_count - 1)
    if state.kkt_rereg and extra_kkt > 0:
        add_svc(
            f"Доп.кассы: перерегистрация/подготовка ККТ (+{extra_kkt})",
            extra_kkt * int(pm['kkt_rereg_points_per_kkt']),
        )
    if state.needs_rr and extra_kkt > 0:
        add_svc(
            f"Доп.кассы: Разрешительный режим (РР) (+{extra_kkt})",
            extra_kkt * int(pm['rr_points_per_kkt']),
        )

    # --- Юрлица ---
    extra_org = max(0, int(state.org_count) - 1)
    if extra_org > 0:
        add_svc(f"Доп.юрлица (+{extra_org})", extra_org * int(pm['org_points_per_extra']))

    # --- Устройства (можно мешать сканеры и ТСД) ---
    scanners, tsd = _device_counts(state)
    extra_scanner = max(0, scanners - 1)
    if extra_scanner > 0:
        add_svc(f"Доп.сканеры (+{extra_scanner})", extra_scanner * int(pm['scanner_setup_points_per_scanner']))

    if tsd > 0:
        rub = tsd * int(pm['tsd_license_rub'])
        if state.tsd_collective:
            rub += tsd * int(pm['collective_tsd_license_rub'])
        add_lic(
            f"Клеверенс: лицензия ТСД ×{tsd}" + (" + коллективная работа" if state.tsd_collective else ""),
            rub,
        )

    # --- Сегменты и сценарии ---
    is_retail, is_wholesale, is_producer = _seg_flags(state)

    if (not state.has_edo) and (is_wholesale or is_producer):
        add_svc("Нет ЭДО (опт/производство)", int(pm['no_edo_wholesale_points']))
    if state.needs_rework:
        add_svc("Остатки/перемаркировка/вывод из оборота", int(pm['rework_points']))
    if state.needs_aggregation:
        add_svc("Агрегация/КИТУ", int(pm['aggregation_points']))
    if state.big_volume:
        add_svc("Большие объёмы/автоматизация", int(pm['big_volume_points']))
    if is_producer and state.producer_codes:
        add_svc("Заказ кодов/нанесение", int(pm['producer_codes_points']))
    if state.custom_integration:
        add_svc("Нестандарт/интеграции (маркер проекта)", int(pm['custom_project_marker_points']))

    points = sum(x.pts for x in service_items)
    rub = _points_to_rub(points, rub_per_point)
    lic_rub = sum(x.rub for x in lic_items)
    return service_items, lic_items, points, rub, lic_rub


def _find_pkg(data: Dict[str, Any], seg: str, prefer_keywords: List[str]) -> Dict[str, Any] | None:
    """Ищем пакет внутри DATA.segments[seg].

    prefer_keywords — список "что предпочитать" (например, сначала "Комбо").
    Если ничего не нашли по ключам — берём первый пакет.
    """
    pkgs = (data.get('segments') or {}).get(seg) or []
    low = lambda s: (s or '').lower()
    for kw in prefer_keywords:
        for p in pkgs:
            if kw and (low(kw) in low(p.get('name'))):
                return p
    return pkgs[0] if pkgs else None


def _choose_package_for_segment(data: Dict[str, Any], seg: str, points: int) -> Dict[str, Any] | None:
    """Выбираем пакет для ОДНОГО сегмента.

    Сейчас логика простая: по названию пакета (prefer list) + по баллам.
    Если захочешь более строгий выбор (например, по порогам),
    проще всего:
      - завести в DATA у пакетов поле min_points/max_points
      - и здесь фильтровать по ним.
    """
    s = (seg or '').lower()
    is_retail = 'розниц' in s
    is_wholesale = 'опт' in s
    is_producer = 'производ' in s

    if is_producer:
        prefer = ['Премиум', 'Оптим', 'Запуск'] if points >= 8 else ['Запуск', 'Старт', 'Оптим']
    elif is_wholesale:
        prefer = ['Комбо', 'Оптим'] if points >= 6 else ['Приемка+Отгрузка', 'Старт', 'Оптим', 'Комбо', 'Приемка', 'Отгрузка']
    elif is_retail:
        prefer = ['Оптим'] if points >= 6 else ['Старт', 'Оптим']
    else:
        prefer = ['Старт', 'Оптим', 'Комбо', 'Запуск']

    return _find_pkg(data, seg, prefer)


def _get_core_packages(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    core = data.get("core_packages") or {}
    pkgs = core.get("packages") or []
    return pkgs if isinstance(pkgs, list) else []


def _core_pkg_segments(pkg: Dict[str, Any]) -> List[str]:
    key = str(pkg.get("segment_key") or "")
    if key == "retail_only":
        return ["retail"]
    if key == "wholesale_only":
        return ["wholesale"]
    if key == "producer_only":
        return ["producer"]
    if key == "producer_retail":
        return ["producer", "retail"]
    return []


def _choose_core_package(data: Dict[str, Any], state: V5Input) -> Tuple[Dict[str, Any] | None, str]:
    core_pkgs = _get_core_packages(data)
    if not core_pkgs:
        return None, ""

    is_retail, is_wholesale, is_producer = _seg_flags(state)
    selected = set()
    if is_retail:
        selected.add("retail")
    if is_wholesale:
        selected.add("wholesale")
    if is_producer:
        selected.add("producer")

    if not selected:
        return None, ""

    exact_key = ""
    if is_retail and not is_wholesale and not is_producer:
        exact_key = "retail_only"
    if is_wholesale and not is_retail and not is_producer:
        exact_key = "wholesale_only"
    if is_producer and not is_retail and not is_wholesale:
        exact_key = "producer_only"
    if is_producer and is_retail and not is_wholesale:
        exact_key = "producer_retail"

    if exact_key:
        match = next((p for p in core_pkgs if p.get("segment_key") == exact_key), None)
        return match, ""

    best = None
    best_score = -1
    best_size = -1
    best_price = -1
    for pkg in core_pkgs:
        segs = _core_pkg_segments(pkg)
        overlap = len([s for s in segs if s in selected])
        size = len(segs)
        price = int(pkg.get("price_rub") or 0)
        if overlap > best_score or (overlap == best_score and size > best_size) or (overlap == best_score and size == best_size and price > best_price):
            best = pkg
            best_score = overlap
            best_size = size
            best_price = price

    warning = "Комбо нестандартное, выбран ближайший пакет." if best else ""
    return best, warning


def _core_pkg_detail(pkg: Dict[str, Any]) -> str:
    lines: List[str] = []
    for group in pkg.get("groups") or []:
        for detail in group.get("details") or []:
            text = detail.get("text")
            if text:
                lines.append(f"• {text}")
    return "\n".join(lines)


def _choose_package(data: Dict[str, Any], state: V5Input, points: int) -> Tuple[Dict[str, Any] | None, str]:
    """Выбираем "главный" пакет.

    По твоему правилу (Вариант 2):
      - если сегментов несколько, мы подбираем пакет для каждого сегмента
      - и берём самый ДОРОГОЙ из найденных.

    Почему так:
      - сегменты могут быть выбраны вместе (например, розница + опт)
      - а людям нужно видеть один пакет в рекомендации.
    """
    core_pkg, warning = _choose_core_package(data, state)
    if core_pkg:
        return core_pkg, warning

    segs = state.segments or []
    if not segs:
        return None, ""

    candidates: List[Dict[str, Any]] = []
    for seg in segs:
        pkg = _choose_package_for_segment(data, seg, points)
        if pkg:
            candidates.append(pkg)

    if not candidates:
        return None, ""

    # max by price
    candidates.sort(key=lambda p: int(p.get('price') or 0), reverse=True)
    return candidates[0], ""


def calculate_v5(state: V5Input) -> V5Result:
    """Основной расчёт для красивого UI (v7).

    Как устроено по шагам (по‑простому):
      1) Берём DATA из frontend/index.html (чтобы всё совпадало с UI)
      2) Считаем доп.услуги (баллы -> рубли) и лицензии (рубли)
      3) Выбираем пакет по сегментам (самый дорогой)
      4) Складываем итог
    """

    data = load_data_from_frontend()
    prelim = _need_diagnostics(state)
    kkt_confirmed = _kkt_count(state) > 0

    service_items, lic_items, pts, svc_rub, lic_rub = _calc_services_and_licenses(state, data)
    pkg, warning = _choose_package(data, state, pts)
    if not pkg:
        pkg = {'name': '—', 'price': 0, 'inc': '', 'who': '', 'detail': ''}
        warning = ""

    base = int(pkg.get('price_rub') or pkg.get('price') or 0)
    diag = int(data.get('diag_price_rub') or 0) if prelim else 0
    support_rub = _points_to_rub(int(data.get('support_points') or 0), int(data.get('rub_per_point') or 0)) if state.support else 0
    total = base + diag + support_rub + svc_rub + lic_rub

    hint = 'Пакет и сумма рассчитаны по чек-листу.'
    if warning:
        hint = f"{warning} {hint}".strip()
    if state.custom_integration:
        hint += ' (Включён маркер проекта: возможны доп. работы/интеграции.)'

    if pkg.get("groups"):
        pkg_block = PackageBlock(
            name=str(pkg.get("title") or pkg.get("name") or '—'),
            price=base,
            inc='',
            who='',
            detail=_core_pkg_detail(pkg),
        )
    else:
        pkg_block = PackageBlock(
            name=str(pkg.get('name') or '—'),
            price=base,
            inc=str(pkg.get('inc') or ''),
            who=str(pkg.get('who') or ''),
            detail=str(pkg.get('detail') or ''),
        )

    return V5Result(
        prelim=prelim,
        package=pkg_block,
        calc=CalcBlock(
            points=pts,
            rub=svc_rub,
            licRub=lic_rub,
            serviceItems=service_items,
            licItems=lic_items,
        ),
        costs=CostsBlock(
            base_rub=base,
            diag_rub=diag,
            support_rub=support_rub,
            services_rub=svc_rub,
            licenses_rub=lic_rub,
            total_rub=total,
        ),
        hint=hint,
        kkt_confirmed=kkt_confirmed,
    )
