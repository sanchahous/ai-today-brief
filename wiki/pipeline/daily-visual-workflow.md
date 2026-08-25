# Daily visual workflow

Summary: production-контур daily cover: одна редакційна теза → один якісний master-кадр →
перевірка сенсу → шість готових social draft’ів. Сторінка потрібна редактору й розробнику для
безпечної заміни кадру без зміни вже опублікованого контенту.
Sources: owner session 2026-08-23/24; `pipeline/daily-visual-finalizer.ts`;
`pipeline/daily-visual-contract.ts`; `pipeline/daily-visual-openrouter.ts`; `pipeline/daily-visual-qa.ts`;
`src/lib/social/daily-visual-composer.ts`; `supabase/migrations/20260824100000_daily_visual_workflow.sql`,
first nightly run 2026-08-25
Last updated: 2026-08-25

---

## Редакційне правило

Daily cover не є колажем і не є декоративною ілюстрацією першої story. Він пояснює **одну
головну тезу дня** як видимий ланцюг `actor/system → зміна → наслідок`; headline дає факт, а
кадр — механізм або практичний ефект. `display_title` є коротким читачевим орієнтиром, тоді як
`visual_thesis` — внутрішній напрям для prompt і QA та не потрапляє в public copy. (source: owner
session 2026-08-23/24; `pipeline/daily-visual-contract.ts`; `src/lib/social/daily-visual-composer.ts`)

No-text — правило за замовчуванням для image model: не просити її малювати цифри, labels,
інтерфейс, логотипи, діаграми чи mascot-robot. Детермінований social overlay допускається лише
як читабельна верстка редакційного тексту; на першому слайді Instagram лишається лише
`display_title` (плюс брендова службова верстка), а не згенероване пояснення. (source: owner
session 2026-08-23/24; `pipeline/daily-visual-contract.ts`; `src/lib/social/daily-visual-assets.ts`)

## Межа дня та заморожений input

О 20:00 `Europe/Kyiv` редакційний день закривається: матеріал після межі належить наступному
daily, без позначки «застаріле». Finalizer створює `daily_visual_set` лише для закритого,
опублікованого дня і зберігає snapshot approved stories до будь-якого paid call. Повторний запуск
не читає поточний mutable brief для вже створеного set. (source: owner session 2026-08-24;
`pipeline/schedule.ts`; `pipeline/daily-visual-finalizer.ts`; `supabase/migrations/20260824100000_daily_visual_workflow.sql`)

Лізинг job має claim token і source hash. Лише поточний lease може записати direction або pointer;
ручний вибір кандидата анулює незавершений worker claim, тому запізнілий воркер не поверне старий
кадр у public projection. (source: `pipeline/daily-visual-finalizer.ts`;
`supabase/migrations/20260824100000_daily_visual_workflow.sql`)

## Рендер, QA і витрати

Автоматична спроба використовує dedicated OpenRouter Image API для **одного** master-кадру,
нормалізованого до 1600×900 через `contain`; за semantic failure можливий один repair, а branded
fallback зберігається тільки як ручний варіант і ніколи не активується мовчки. Картинка проходить
deterministic, image-only і story-aware semantic QA; автоматично може активуватися лише route,
що пройшов усі гейти — primary або один pinned repair. Image-only critic з 2026-08-25 має
явно ставити бали 0–100 і **не** гейтить `news_legibility` (цей floor лишається для
story-aware). Likert 0–1 / 1–5, які Flash віддав на першому nightly `2026-08-24`, rescale-яться,
інакше чистий кадр з notes «No pixel defects» падає на fake `news_legibility: 1`.
(source: прод-Supabase live check 2026-08-25; `src/lib/content-sim/vision-critic.ts`;
`pipeline/daily-visual-openrouter.ts`; `pipeline/daily-visual-storage.ts`;
`pipeline/daily-visual-qa.ts`; `pipeline/daily-visual-finalizer.ts`)

### Dynamic route без непрозорого auto-router

У worker не використовується `openrouter/auto`, `~latest` або provider fallback. Перед першим
paid render він читає Image Models API і per-endpoint records, допускає тільки stable
Pro `bytedance-seed/seedream-*` та `qwen/qwen-image-*` з native `16:9`, `n=1`, конкретним
`provider_tag` і доведеним all-in fixed output price не більшою за $0.05. Token, megapixel,
per-request та text-input billing відсікаються; optional input-image line допустима лише тому, що
daily payload не містить input references. Ціна без `variant` означає найдешевший declared
tier конкретного endpoint (у Seedream 5.0 Pro це 1K за $0.045, тоді як 2K названо окремим
`high_resolution`), тому вона приймається лише для base tier; вищий tier без власного іменованого
variant не має доведеної ціни і відкидається. У JSONB direction зберігається private frozen
`daily_visual_image_route`: model, pinned provider, resolution, expected price, catalog hash,
primary/repair і eventual winner. Кожен request також несе OpenRouter `provider.max_price.image`,
тому зміна ціни блокує dispatch ще до provider call. Тому retry ніколи не переходить на модель,
яка з'явилася після першої спроби. (source: [OpenRouter Image Generation API](https://openrouter.ai/docs/guides/overview/multimodal/image-generation);
 [OpenRouter Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection);
`pipeline/daily-visual-openrouter.ts`; `pipeline/daily-visual-finalizer.ts`)

Перший live route надає пріоритет Seedream 5.0 Pro у 1K/16:9 ($0.045) з незалежним Qwen Image 3
Pro у 1K/16:9 ($0.040) repair, але **немає** hard-coded paid fallback: якщо каталог, champion
або друга independent route не можна перевірити, worker зупиняється на manual choice. Нове Pro
покоління Seedream або пізніше доданий Qwen може стати **canary primary**; Lite та інші
same-generation SKU не є автоматичним upgrade. Canary має пройти повний QA. Якщо він не
рендериться або не проходить QA, repair іде через frozen champion; якщо repair активувався,
canary model потрапляє у private reject history і не оплачується знову щодня. Якщо canary
пройшов, він стає winner/champion наступного active set. Repair established champion — це
одноразове відновлення, а не непомітна зміна global champion. Це baseline safety gate, не дорогий
paired aesthetic benchmark двох full renders на кожен день. (source:
`pipeline/daily-visual-openrouter.ts`; `pipeline/daily-visual-finalizer.ts`)

Якщо direction не дійшов навіть до AI candidate, owner з AAL2 має рівно один bounded recovery:
нова direction, один primary і обидва QA без repair (максимум $0.084). Він не переписує перший
direction ledger і не активує fallback. Якщо GitHub dispatch цього вже queued recovery не стартує,
та сама owner+AAL2 дія може повторити **лише доставку** exact historical date — без другої
reservation чи нової paid спроби. (source:
`supabase/migrations/20260824170000_daily_visual_direction_retry.sql`;
`src/lib/daily-visual/retry-state.ts`; `src/app/admin/(cms)/daily-visuals/actions.ts`)

БД резервує кожен paid step до виклику і має місячний hard cap **$5.00**. Максимально
задекларований automated day — $0.158 (director + primary + два QA проходи + repair + два QA
проходи); 31 такий день = $4.898. Невідома або неоднозначна фактична ціна не звільняє резерв:
вона лишається `held_for_reconcile`, тому система fail-closed замість тихо виходити за бюджет.
(source: owner decision 2026-08-24; `pipeline/daily-visual-contract.ts`;
`pipeline/daily-visual-finalizer.ts`; `supabase/migrations/20260824100000_daily_visual_workflow.sql`)

Для completed OpenRouter image response worker звіряє `usage.cost` із frozen endpoint price і
атомарно переводить exact sum з reservation у committed ledger. Відсутня, недостовірна або більша
за frozen price сума лишає повну reservation `held_for_reconcile`; такий rendered candidate лишається
лише private для owner review і не допускається до automatic publication. (source:
[OpenRouter Image Generation API](https://openrouter.ai/docs/guides/overview/multimodal/image-generation);
`pipeline/daily-visual-openrouter.ts`; `pipeline/daily-visual-finalizer.ts`)

Якщо worker впав після reservation — навіть **до** появи Storage candidate — retry знаходить той
самий exact slot за `set + step + attempt`, але не робить другого provider call. `reserved` він
атомарно переводить у `held_for_reconcile`; якщо інший worker уже його settle-нув, повтор так само
зупиняється без render. Лише `committed` сума в межах frozen route може перейти до QA; reserved,
held або відсутня reservation залишає bytes private і не обходить cost gate. (source:
`pipeline/daily-visual-finalizer.ts`; `supabase/migrations/20260824100000_daily_visual_workflow.sql`)

Це application-side budget fence: перед викликом система не дозволить зарезервувати наступний
planned step понад cap. Вона не може скасувати вже надісланий request, якщо provider пізніше
змінить ціну або донарахує usage, тому при rollout також потрібен незалежний $5 spend alert/limit
у provider account. (source: `pipeline/daily-visual-finalizer.ts`;
`pipeline/daily-visual-contract.ts`)

Цей cap застосовується лише до daily/weekly digest visual work. News-card images лишаються на
існуючій автоматичній моделі й pipeline; для них змінено редакційний prompt, але не додано
manual gate або daily budget. (source: owner session 2026-08-24; `pipeline/card-image.ts`)

## Ручний контроль і source images

У `/admin/daily-visuals` редактор з AAL2 може вибрати AI candidate або завантажити replacement.
Official source image дозволена тільки як явно дозволений press/media asset, офіційний
product/UI screenshot або файл, який завантажив редактор; реальний текст на такому UI допустимий,
але generated text — ні. Вибір зберігає immutable history та selection event. (source: owner
session 2026-08-24; `src/app/admin/(cms)/daily-visuals/actions.ts`;
`supabase/migrations/20260824100000_daily_visual_workflow.sql`)

Заміна master-кадру створює новий candidate-bound social package. Лише draft/in-review/approved/
scheduled/failed posts можуть бути скасовані й відтворені; `publishing`, `posted` та
`needs_reconciliation` залишаються недоторканими. Один package може бути змішаним, тому це
правило застосовується до кожного post, а не all-or-nothing до всього пакета. (source:
`src/lib/social/daily-visual-composer.ts`)

## Сайт і social package

Hero daily та weekly показують 16:9 master повністю через `object-contain`, mask для читабельного
тексту і мінімальну висоту, тому короткий текст не ріже нижню частину кадру. На першому екрані
залишаються date + short display title; весь розгорнутий intro відкривається лише через
«Показати більше». (source: owner screenshots 2026-08-23; `src/components/daily/daily-hero.tsx`;
`src/components/weekly/weekly-hero.tsx`; `src/app/globals.css`)

Після activation composer готує, але поки не автопублікує, шість native review drafts:

- UK: Telegram, Facebook, Threads;
- EN: X, LinkedIn, Instagram;
- Instagram: один master + 5-slide carousel, без PDF/LinkedIn document для daily.

Кожен draft використовує збережені approved facts і native pattern `hook → thesis → до 3 stories
→ CTA/link`; social assets беруть один selected master з `contain`, не multi-image collage.
(source: owner session 2026-08-24; `src/lib/social/daily-visual-composer.ts`;
`src/lib/social/daily-visual-assets.ts`)

## Вимірювання без стеження

Подія `visual_impression` означає ≥50% hero у viewport, active tab і 1 cumulative second;
додатково фіксуються лише 3s/8s milestones та агреговані outcomes (`story_open`, `scroll_50`,
`outbound_click`, `signup_click`) після qualified impression. Client не збирає gaze, cursor,
скрол-позицію, referrer або URL; сервер зберігає лише hash IP+UA+day+salt і відсікає outcome без
попереднього impression тієї ж rotating session. (source: owner session 2026-08-24;
`src/lib/daily-visual-engagement.ts`; `src/app/api/daily/visual-engagement/route.ts`;
`supabase/migrations/20260824120000_daily_visual_engagement.sql`)

1 second — це не твердження, що читач «дивився на картинку рівно секунду», а консервативна
технічна межа qualified exposure. Вона узгоджується з базовим IAB/MRC threshold для viewable
display, тоді як дослідження scene gist показують, що категорію сцени люди часто зчитують у межах
однієї fixation; детальне пояснення все одно потребує title, часу і поведінкового outcome.
(source: [IAB viewability guidance](https://www.iab.com/news/viewability-has-arrived-what-you-need-to-know-to-see-through-this-sea-change/);
[Web pages: What can you see in a single fixation?](https://pmc.ncbi.nlm.nih.gov/articles/PMC5945715/);
owner session 2026-08-24)

## Операційний шлях

1. Після cutoff worker формує frozen set, direction, primary + fallback і QA.
2. Якщо primary пройшов — він автоматично активується; якщо ні — admin показує останній AI та
   fallback для явного вибору. Лише direction-failure без AI candidate має один owner+AAL2
   bounded recovery; repair для нього заборонений.
3. Редактор за потреби завантажує allowed source/editor image або обирає candidate.
4. Composer створює нові mutable social drafts, які редактор може вставити у відповідні мережі.
5. Для якості дивимося не лише render/QA, а qualified exposure → outcome; це сигнал для
   наступного holdout, а не доказ retention сам по собі.

(source: `pipeline/daily-visual-finalizer.ts`; `src/app/admin/(cms)/daily-visuals/actions.ts`;
`src/lib/social/daily-visual-composer.ts`; `src/lib/daily-visual-engagement.ts`)

## Related pages

- [image-prompt-library](image-prompt-library.md)
- [weekly-digest](weekly-digest.md)
- [card-images](../marketing/card-images.md)
- [omni-channel-publishing-matrix](../marketing/omni-channel-publishing-matrix.md)
- [weekly-admin-runbook](../ops/weekly-admin-runbook.md)
