# Каталог статусних фрагментів задач

Summary: один файл на задачу замість спільних списків, які паралельні PR переписували в тих самих рядках.
Sources: вибір власника A, 2026-10-03; [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405)
Last updated: 2026-10-03

---

<!-- task-status: fragments -->

Задача пише **лише** новий або свій файл `wiki/tasks/<id>.md` (`ah-3.5.md`, `atb-67.md` — id малими літерами). У цьому файлі живуть статус, рядок журналу і «наступна задача».

PR задачі **не редагує**:

- список «Стан репозиторію» і рядок `Last updated` у [now.md](../now.md);
- рядок `Sources:` і статусну клітинку handoff у [index.md](../index.md);
- список відкритих PR і абзац «наступна задача» в [handoff](../product/after-hours-epic-handoff.md);
- таблицю §5.3 в [епіку](../product/after-hours-redesign-epic.md);
- верх [log.md](../log.md).

Ці сторінки — стабільні посилання. Зведення друкує `npm run wiki:tasks` і нічого не комітить. `wiki:check` перевіряє форму фрагмента і що перенесені записи на місці.

Історичний текст спільних рядків, знятий з тих сторінок дослівно, лежить у [archive-shared-lines.md](archive-shared-lines.md) і у файлах задач. Нова сторінка вікі (не статус задачі) як і раніше отримує один новий рядок в index.

(source: ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))

## Related pages

- [now](../now.md)
- [after-hours-epic-handoff](../product/after-hours-epic-handoff.md)
- [after-hours-redesign-epic](../product/after-hours-redesign-epic.md)
