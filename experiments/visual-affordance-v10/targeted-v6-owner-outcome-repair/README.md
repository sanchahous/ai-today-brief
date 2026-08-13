# Visual Affordance V10 — targeted v6 owner outcome repair

Summary: поточний V10 candidate після owner-approved local repairs для Gemini, Claude Usage Thresholds та Deep Work.
Sources: owner review 2026-08-13 у Codex task; [evaluation report](results/evaluation-report.md); [render report](results/render-report.md); [V5 run](../targeted-v5-owner-local-repair/README.md).

---

## Зміни від V5

- **Gemini consistency:** один task і один model chamber тепер розгалужуються у два структурно різні code artifacts.
- **Claude thresholds:** один cache → split flow подає три явно позначені bounded sessions; monitor пов’язаний з усіма трьома.
- **Deep Work:** hint card є єдиною ціллю променя; людина вставляє фінальний tile, який замикає один видимий маршрут до finish marker.

## Automatic evaluation

`google/gemini-2.5-flash`, image-only intent-blind stage + headline-paired stage:

- hard visual integrity: **3/3** V10, 0/3 V8;
- headline-paired grounding: **3/3** V10, 0/3 V8;
- blind preference: V10 **3**, V8 **0**, ties **0**;
- 6 vision calls, reported cost **$0.0148**.

Деталі — у [evaluation report](results/evaluation-report.md), [evaluation JSON](results/evaluation.json) та [evaluated contact sheet](results/evaluated-contact-sheet.png).

## Статус

Автоматична перевірка не дозволяє production publication. Для кожної з трьох карток потрібен явний фінальний owner verdict: `approve`, `local repair`, `major rework` або `reject`.
