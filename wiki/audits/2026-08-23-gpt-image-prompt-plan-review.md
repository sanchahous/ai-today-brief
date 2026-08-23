# Review плану промптів GPT-Image і weekly-layout — 2026-08-23

Summary: ревʼю Prompt-as-Code v6 і weekly UI після owner-скрінів. Критерій якості — заголовок і зображення разом пояснюють одну причинно-наслідкову зміну за 2–3 секунди; код переведено на один primary candidate, fail-closed semantic auto-attestation і safe-frame показ зображень.
Sources: owner session і скріни weekly `ai-weekly-2026-08-09` 2026-08-23; `pipeline/card-image.ts`; `pipeline/image-prompt-library/**`; `src/lib/weekly-digest/**`; `src/components/weekly/**`; локальна browser-перевірка 2026-08-23.
Last updated: 2026-08-23

---

## Висновок

Найкращий шлях до retention тут — не ефектна абстрактна метафора і не спроба намалювати весь заголовок. Це стала редакційна мова: **headline називає факт, а картинка показує один видимий ланцюг `актор/система → зміна → наслідок`**. Читач має одразу відчути, що AI Today Brief не просто повідомляє, а пояснює. Пріоритет: **ясність → причинність → емоція**. (source: відповіді власника 2026-08-23; owner-скріни Qwen, ALTK-Evolve, PrivAiTe, Deadbugz і Riemann)

Ціль не в тому, щоб картинка самотужки передала всі цифри або всю статтю. Blind 2-second test має підтвердити, що без дрібного тексту видно головний обʼєкт, фізичну зміну і grounded result; разом із заголовком це утворює одну `pair claim`. (source: owner session 2026-08-23; `pipeline/card-image.ts` `EditorialEssence.readerTest`)

## Що у вихідному плані було сильним

План правильно відділив semantic contract (`context → meaning → mechanism → consequence`) від стилю, заборонив надійно нечитабельний текст у пікселях, залишив рішення за людиною і вже мав mapping/vision gates. Це добра база для пояснювального зображення, а не для випадкового stock-art. (source: `pipeline/card-image.ts`; `pipeline/concept-mapping-gate.ts`; `wiki/pipeline/weekly-illustration-plan.md`)

Prompt-as-Code також є правильним напрямком: явно розділені subject, action, setting, композиція, світло й негативні обмеження легше тестувати, ніж один довгий prose-prompt. (source: `pipeline/image-prompt-library/assemble.ts`; `pipeline/image-prompt-library/templates.ts`)

## Критика, яка змінила реалізацію

| Пріоритет | Знахідка | Чому це руйнує ціль | Рішення |
|---|---|---|---|
| P0 | Глобальний `sibling_template_reuse` вимагав унікальних шаблонів між усіма stories дайджесту, хоча каталог має пʼять шаблонів. | Для дайджесту з більш ніж пʼятьма слотами це математично недосяжно; система неминуче йшла у fallback. | Прибрано як глобальний blocker; template diversity лишається лише всередині свідомо multi-concept experiment. |
| P0 | Fallback передавав planning-фрази на кшталт `the story-specific anchor is…` у renderable поля. | Модель отримувала редакторську інструкцію замість сцени, що пояснює darkroom/prose-провали. | Санітизуються `scene`, `subject`, `action`, `setting`; semantic fallback формує фізичний causal moment. |
| P1 | Три owner-facing концепти були страховкою від невлучання, але не доведеним механізмом відбору. | Вони перетворюють редактора на вибирача лотереї та суперечать рішенню власника оптимізувати один правильний результат. | `prompt_only` і production `render` дають один primary candidate; critic rejection стає repair brief наступної спроби. |
| P1 | Старі technical templates просили 3–5 модулів, callouts і нумерацію. | Це прямо провокує скріни з фейковим UI, псевдотекстом, роботами та component soup. | Один hero object/state change, максимум один unlabeled connector; заборонені dashboard cards, code panels і mascot robots. |
| P1 | Upload QA перевіряв лише craft пікселів. | Естетично чиста, але семантично неправильна картинка могла отримати «QA чисто». | Другий story-aware pass після clean pixel pass, advisory-only для власника. |
| P1 | `cover` crop у pipeline й `object-cover` у public UI могли знищити ключовий обʼєкт. | Навіть вдалий prompt не виконує свою функцію, якщо користувач бачить лише частину сцени. | 16:9 branded canvas із `contain`, `object-contain` у story/hero, edge-anchor regression test. |
| P1 | Довгий hero-title/standfirst і `items-end` відсовували обкладинку та Story 1 далеко вниз. | Сторінка починала з перевантаженої типографіки замість швидкого входу у випуск. | На desktop компактний H1 і cover стоять поруч від верхнього краю; stories ідуть перед video/action/FAQ, є редакційний length gate. |

Усі висновки таблиці походять із коду до/після зміни, owner-скрінів та локальної перевірки; це не твердження про автоматично виміряний retention. (source: `pipeline/card-image.ts`; `pipeline/image-prompt-library/templates.ts`; `src/lib/encode-site-image.ts`; `src/components/weekly/weekly-hero.tsx`; owner session 2026-08-23)

## Реалізований контракт primary illustration

`prompt_only` тепер запитує рівно один primary brief: одна сцена, один впізнаваний actor/system, одна фізично видима дія, один grounded outcome. Exact numbers, labels або діаграма не вбудовуються у generated pixels; їх допустимо додати пізніше детермінованим overlay лише коли без цього не передається факт. (source: `src/lib/weekly-digest/story-prompt-job.ts`; `src/lib/weekly-digest/generation-worker.ts`; `pipeline/image-prompt-library/assemble.ts`)

Це не означає, що literal scene завжди краща за метафору. Вибір визначає test: чи допомагає scene без декодування побачити механізм конкретної новини? Для routing, security sequence, architecture і точних порівнянь наступний етап — детермінована geometry/hybrid; для події, людини або продукту — спокійна редакційна сцена. (source: owner session 2026-08-23; `pipeline/image-prompt-library/route.ts`; `pipeline/image-prompt-library/templates.ts`)

## Semantic QA після ручного upload

У `story_prompt_set` тепер зберігається render-independent semantic contract. Після upload `story_image` QA спершу перевіряє лише пікселі, а тільки після чистого першого проходу отримує headline, approved story fields (зокрема counterweight), primary scene і contract. Невдалий semantic score без явного blocker штучно перетворюється на `ambiguous_visual_story`, щоб власник не побачив хибне «QA чисто». Перевірка суто advisory для ручного release: вона не ставить `content_sim` і не блокує редактора, але за відсутнього story-aware pass або будь-якого active QA blocker файл не проходить machine attestation. (source: `src/lib/weekly-digest/story-prompt-set.ts`; `src/lib/weekly-digest/run-post-upload-qa.ts`; `src/app/admin/(cms)/weekly/actions.ts`; `src/lib/weekly-digest/post-upload-qa.ts`; `src/lib/weekly-digest/machine-attest.ts`)

## Виправлення public weekly experience

Hero більше не вирівнює обкладинку по нижньому краю дуже довгого тексту: на desktop вона стоїть поруч із компактним title від верхнього краю. Картинки показуються в 16:9 safe frame без тихого crop, а Story 1 зʼявляється перед допоміжними блоками. Sidebar тепер має keyboard-accessible active state (`aria-current="location"`) після click, hash або scroll. (source: `src/components/weekly/weekly-hero.tsx`; `src/components/weekly/weekly-story.tsx`; `src/lib/encode-site-image.ts`; `src/app/[lang]/weekly/[slug]/page.tsx`; `src/components/weekly/weekly-toc.tsx`)

## Перевірка та межі висновку

Початковий targeted Vitest для prompt assembly, fallback, primary prompt, semantic QA, safe-frame,
copy gate і TOC пройшов: 11 файлів, 250 тестів. Після фінальних корекцій повний `npm run test`
пройшов: 186 файлів, 1704 тести; `next build` (включно з TypeScript), full ESLint без errors,
`git diff --check` і `wiki:check` зелені. Локальна browser-перевірка weekly route підтвердила
`object-fit: contain`, видимий cover на першому екрані, compact H1 поруч із cover, stories перед
video/action і активний `#story-2` після click/scroll без console errors.
(source: локальні `npm run test`, `npm run build`, `npm run lint`, `npm run wiki:check`,
`git diff --check`, browser verification 2026-08-23)

Це ще не доказ покращення retention або генеративної якості в проді. Потрібен holdout із 20–30 реальних історій: blind description по pixels, оцінка `headline + image` проти v5.1 і owner verdict із причиною reject. Vision critic — корисний сигнал, але не незалежний суддя й не має отримати право автоматично обирати або публікувати. (source: owner session 2026-08-23; `src/lib/weekly-digest/run-post-upload-qa.ts`)

## Відкрите продуктове рішення

Для справді стабільного hero потрібне окреме поле `display_title` (орієнтир: 2–4 рядки) поруч із повним SEO/title. Поточний hard gate у 112 символів запобігає новим екстремальним випадкам, але не дає редактору незалежно керувати SEO-заголовком і першою екранною композицією. Це schema/editorial-contract рішення, тому його не внесено без явного рішення власника. (source: `src/lib/weekly-digest/content-studio.ts`; owner screenshots 2026-08-23)

## Related pages

- [image-prompt-library](../pipeline/image-prompt-library.md)
- [weekly-digest](../pipeline/weekly-digest.md)
- [weekly-illustration-plan](../pipeline/weekly-illustration-plan.md)
- [card-images](../marketing/card-images.md)
- [weekly-admin-runbook](../ops/weekly-admin-runbook.md)
