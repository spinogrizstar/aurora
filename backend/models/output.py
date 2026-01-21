# Описание результата расчёта

from pydantic import BaseModel
from typing import List

class ChecklistResult(BaseModel):
    complexity_points: int
    package_name: str
    works: List[str]
