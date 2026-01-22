from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class KktItem(BaseModel):
    """Одна выбранная касса."""

    vendor: str = Field(default="", description="Производитель (например: АТОЛ)")
    model: str = Field(default="", description="Модель кассы (например: 11Ф)")


class DeviceItem(BaseModel):
    """Одно устройство (для совместимости).

    Сейчас UI хранит устройства как счётчики (сканер/ТСД).
    Но бэкенд оставляет поддержку списка, чтобы не ломать старые версии UI.
    """

    type: Literal["scanner", "tsd"] = Field(default="scanner", description="scanner=сканер, tsd=ТСД")


class ContactsBlock(BaseModel):
    """Контакты и цель (пункт 7)."""

    legal_name: Optional[str] = Field(default=None, description="Юрлицо/компания")
    inn: Optional[str] = Field(default=None, description="ИНН")
    contact_name: Optional[str] = Field(default=None, description="Контактное лицо")
    phone: Optional[str] = Field(default=None, description="Телефон")
    email: Optional[str] = Field(default=None, description="Email")
    desired_result: Optional[str] = Field(default=None, description="Что клиент хочет получить в итоге")


class ProductBlock(BaseModel):
    """Данные по продукции (для производителя)."""

    categories: List[str] = Field(default_factory=list)
    comment: Optional[str] = None


class OneCBlock(BaseModel):
    """Выбор конфигурации 1С (для протокола/КП и будущих правил расчёта)."""

    config: Optional[str] = Field(default=None, description="ID/название конфигурации 1С")
    actual: bool = Field(default=True, description="Актуальна ли конфигурация (обновлена/поддерживается)")


class V5Input(BaseModel):
    """Входные данные из UI (state). v6: мультисегменты, списки ККТ/устройств, юрлица степпер, контакты."""

    segments: List[str] = Field(min_length=1, description="Выбранные сегменты (можно несколько)")

    # 1С
    onec: Optional[OneCBlock] = Field(default=None, description="Конфигурация 1С и её актуальность")

    # ККТ (списком, изначально 0)
    kkt: List[KktItem] = Field(default_factory=list, description="Список выбранных ККТ. Можно пустой.")
    uses_kkt: bool = Field(default=True, description="Есть продажи через ККТ (галочка)")
    kkt_rereg: bool = Field(default=True, description="Нужна перерегистрация/подготовка ККТ под маркировку")
    needs_rr: bool = Field(default=True, description="Нужен Разрешительный режим (РР) на кассе")

    # Устройства (сканеры/ТСД) списком, можно смешивать
    devices: List[DeviceItem] = Field(default_factory=list, description="Список устройств (совместимость со старым UI)")
    tsd_collective: bool = Field(default=False, description="Клеверенс: коллективная работа")

    # 1С
    onec: Optional[OneCBlock] = None

    # Юрлица
    multi_orgs: bool = Field(default=False, description="Несколько юрлиц")
    org_count: int = Field(ge=1, default=1, description="Количество юрлиц (>=1)")

    # Сценарии/сложности
    has_edo: bool = Field(default=True, description="Есть ЭДО")
    needs_rework: bool = Field(default=False, description="Остатки/перемаркировка/вывод из оборота")
    needs_aggregation: bool = Field(default=False, description="Агрегация/КИТУ")
    big_volume: bool = Field(default=False, description="Большие объёмы/автоматизация")
    producer_codes: bool = Field(default=False, description="Производитель: заказ кодов/нанесение")
    custom_integration: bool = Field(default=False, description="Нестандарт/интеграции (маркер проекта)")

    support: bool = Field(default=False, description="Поддержка 5 дней")

    contacts: Optional[ContactsBlock] = None

    # Для производителя: товарные группы Честного Знака и комментарий
    product: Optional[ProductBlock] = None


class ServiceItem(BaseModel):
    label: str
    pts: int


class LicenseItem(BaseModel):
    label: str
    rub: int


class CalcBlock(BaseModel):
    points: int
    rub: int
    licRub: int
    serviceItems: List[ServiceItem]
    licItems: List[LicenseItem]


class PackageBlock(BaseModel):
    name: str
    price: int
    inc: str = ""
    who: str = ""
    detail: str = ""
    groups: List[dict] = Field(default_factory=list)


class CostsBlock(BaseModel):
    base_rub: int
    diag_rub: int
    support_rub: int
    services_rub: int
    licenses_rub: int
    total_rub: int


class V5Result(BaseModel):
    prelim: bool
    package: PackageBlock
    calc: CalcBlock
    costs: CostsBlock
    hint: str

    # Для удобства UI
    kkt_confirmed: bool
