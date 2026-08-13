# Visual Affordance V10 — targeted V6 owner outcome repair

Поточний кандидат V10 після локальних правок з owner review від 2026-08-13 та додаткового V5-ремонту для Deep Work.

## Зміни відносно V5

- **Gemini:** одна задача подається в модель і дає два помітно різні code artifacts.
- **Claude:** явний лінійний потік cache → split → BOUNDED 1/2/3; MONITOR отримує сигнали з кожної bounded session.
- **Deep Work:** промінь пристрою веде лише до картки-підказки; рука людини встановлює останній квадрат у маршрут, який явно доходить до фінішу.

## Автоматична перевірка

- Judge: `google/gemini-2.5-flash`.
- Hard visual integrity: **3/3 V10**, проти 0/3 V8.
- Headline grounded: **3/3 V10**, проти 0/3 V8.
- Середній score: **87.2 V10**, проти 54.1 V8.
- Blind preference: **3 V10 / 0 V8 / 0 ties**.

Джерела: [evaluation-report.md](evaluation-report.md), [evaluation.json](evaluation.json), [render-report.json](render-report.json), [evaluated-contact-sheet.png](evaluated-contact-sheet.png). Попередній проміжний прогін: [V5](../../targeted-v5-owner-local-repair/results/README.md).

## Статус

Автоматичного пропуску в production немає. Потрібен лише фінальний owner verdict для трьох візуалів: `approve`, `local repair`, `rework` або `reject`.
