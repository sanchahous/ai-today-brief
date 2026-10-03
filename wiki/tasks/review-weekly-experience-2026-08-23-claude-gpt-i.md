# review-weekly-experience-2026-08-23-claude-gpt-i

Summary: Статусний фрагмент review-weekly-experience-2026-08-23-claude-gpt-i. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: review-weekly-experience-2026-08-23-claude-gpt-i

## Status

### now.md

```verbatim
- **Review промптів і weekly experience (2026-08-23), робоча копія для
  `claude/gpt-image-prompt-plan-review-2ffff7`.** Owner-скріни дайджесту
  `71af784b-3c89-47f8-bc38-e3eae4def2a7` підтвердили три незалежні дефекти: planning-prose
  та три lottery concepts замість одного пояснювального primary prompt, semantic mismatch після
  upload без надійного owner warning, і crop/layout, що ховав зміст картинки й Story 1. Тепер
  `prompt_only` і production `render` беруть один 6-block cause-and-effect кандидат
  (`weekly-semantic-story-v6`), планування не потрапляє у renderable fields, clean story upload має
  другий story-aware QA pass і жоден active QA blocker або відсутній semantic pass не
  auto-attest-иться. Public weekly показує 16:9 safe-frame і поруч на desktop compact title +
  top-aligned cover, stories перед допоміжними блоками та active ToC. Після merge: перегенерувати лише
  `story_prompt_set` на цьому дайджесті, згенерувати/завантажити один primary кадр і перевірити
  його у Visuals; master rewrite не потрібен.
  (source: owner session 2026-08-23; [gpt-image-prompt-plan-review](audits/2026-08-23-gpt-image-prompt-plan-review.md);
  `pipeline/card-image.ts`; `src/lib/weekly-digest/run-post-upload-qa.ts`)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
