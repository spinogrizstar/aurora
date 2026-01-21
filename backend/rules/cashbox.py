# Расчёт работ по кассам

def calculate_cashbox(cashbox_count: int):
    complexity_points = 10
    works = ["Настройка первой кассы под маркировку"]

    for i in range(2, cashbox_count + 1):
        complexity_points += 8
        works.append(f"Настройка кассы №{i} под маркировку")

    return complexity_points, works
