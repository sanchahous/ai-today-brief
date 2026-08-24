# Image prompt library (Prompt-as-Code)

Summary: як AI Today Brief збирає copy-ready промпти для картинок: один primary weekly prompt із 6 блоків, 5 шаблонів з awesome-gpt-image-2, policy `weekly-semantic-story-v6`, без тексту в пікселях.
Sources: `pipeline/image-prompt-library/`, `pipeline/card-image.ts`, `pipeline/prompt-export.ts`, [awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2) (MIT), owner session 2026-08-23 (digest `71af784b-…`)
Last updated: 2026-08-23

---

Система не вендорить галерею з 500 кейсів і не ставить upstream Agent Skill у прод.
Береться **MIT-структура** Prompt-as-Code: атомарні поля + 6 блоків збору + 5 шаблонів.
Атрибуція: [`pipeline/image-prompt-library/NOTICE.md`](../../pipeline/image-prompt-library/NOTICE.md).
(source: [awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2), рішення плану 2026-08-23)

Текст у пікселях **заборонений** (D1). GPT-Image-2 вміє літери, але overlay соц/web і FLUX.2 klein
на новинах ламаються від впечених підписів; цифри на кшталт «85%» небезпечно віддавати моделі.
Technical scene може показати максимум два фізичні стани й один unlabeled connector; точний label
додається окремим deterministic overlay лише коли без нього не читається факт.
(source: `pipeline/image-prompt-library/templates.ts`, `pipeline/image-prompt-library/assemble.ts`, owner session 2026-08-23)

## Навіщо v6

На живому weekly `71af784b-3c89-47f8-bc38-e3eae4def2a7` три концепти злипались в один darkroom,
а canonical зливав поля планування (`the story-specific anchor is…`) і editorial-прозу
(`Teams should audit…`) у рядок для моделі. `flattenMetaphorPitch` і `composeDiagramCanonical`
це робили навмисно. v6 розділяє renderable scene від QA-notes і збирає canonical 6 блоками.
(source: owner session 2026-08-23, `pipeline/card-image.ts`, `pipeline/prompt-export.ts`)

Політика: **`weekly-semantic-story-v6`**.
(source: `pipeline/card-image.ts` `WEEKLY_PROMPT_POLICY`)

## Потік

```
essence → routeTemplate(primary) → one editorial director → mapping gate → assembleSixBlocks → Visuals copy
```

`prompt_only` створює **один primary direction**: actor/system, фізична зміна і grounded result
в одному спокійному кадрі. Механізм не розкладається на panels, а planning fields не потрапляють
у renderable string. (source: `src/lib/weekly-digest/story-prompt-job.ts`; `pipeline/card-image.ts`; `pipeline/image-prompt-library/assemble.ts`)

`render` також просить **один** кандидат на спробу: відхилення vision повертає конкретний repair
brief для наступного кадру, а не три лотерейні варіанти з одного brief. `routeSeatTemplates`
лишається low-level інструментом для свідомого offline порівняння; template diversity має сенс
лише там. Глобальна унікальність між усіма stories не є gate, бо каталог має лише пʼять templates.
Jaccard echo і motif checks і далі працюють за renderable `subject/action/setting`, а не за planning
prose. (source: `pipeline/image-prompt-library/route.ts`; `pipeline/card-image.ts` `validateMetaphorPitch`; `src/lib/weekly-digest/generation-worker.ts`)

## Поверхні

- **Weekly story** (`prompt_only`): один primary 6-block cause-and-effect prompt. Visuals показує
  його template badge і semantic notes; застарілі multi-prompt artifacts лишаються читабельними.
- **Daily cover**: один кадр, зазвичай `scene-storytelling`, той самий асемблер.
- **News cards** (FLUX.2 klein): ті самі поля сцени, **без** `infographic-engine`; wrap
  `assembleFluxCardPrompt`.
(source: `pipeline/prompt-export.ts`, `pipeline/daily-cover-prompt.ts`, `pipeline/card-image.ts` `buildPrompt`)

## Агентський запасний контур

House skill [`.agents/skills/gpt-image-2-editorial/SKILL.md`](../../.agents/skills/gpt-image-2-editorial/SKILL.md)
для ручних промптів. Upstream `npx skills add freestylefly/awesome-gpt-image-2` у пайплайн не ставимо.

## Related pages

- [card-images](../marketing/card-images.md)
- [weekly-illustration-plan](weekly-illustration-plan.md)
- [weekly-digest](weekly-digest.md)
- [content-sim](content-sim.md)
- [now](../now.md)
