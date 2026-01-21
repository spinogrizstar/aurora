# Выбор пакета услуг

def select_package(points: int) -> str:
    if points <= 30:
        return "START"
    if points <= 60:
        return "STANDARD"
    return "PRO"
