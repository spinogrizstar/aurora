# Описание входных данных от клиента

from pydantic import BaseModel, Field


class ChecklistInput(BaseModel):
    # Количество касс должно быть минимум 1
    cashboxes: int = Field(ge=1)
    support: bool = False
