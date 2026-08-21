# Аудит: реліз `ai-weekly-2026-08-09` і машина випуску

Summary: backtest єдиного опублікованого weekly за серпень 2026 — затримка була не в
картинках/відео, а в ~28 ручних Approve і ланцюгу прод-багів; ціль — автопілот до
одного екрана рев’ю на галюцинації.
Sources: прод-Supabase `mdiqfatpqczwqghwttpm` live check 2026-08-21 (`weekly_digests`,
`weekly_digest_artifacts`, `weekly_digest_generation_jobs`, `social_posts`,
`generation_cost_events`), `gh pr list` 09–21.08.2026, [now](../now.md),
[weekly-admin-runbook](../ops/weekly-admin-runbook.md),
[omni-channel-publishing-matrix](../marketing/omni-channel-publishing-matrix.md)
Last updated: 2026-08-21

---

## Вердикт

Реліз `ai-weekly-2026-08-09` (digest `6cbcf0b3-187d-4d7d-9eb9-66bdff1c72d4`,
published revision `3e955086-a5b4-47d0-9589-367d895b85df`) **опубліковано 20.08 13:30
Kyiv** — **5 днів** після кінця тижня (09–15.08) і **~4 календарні дні** після створення
16.08 08:53 Kyiv. Це не «довгий LLM». Це пожежний цикл: **87 merged PR за 9–21.08**,
з яких більшість — reactive hotfix під цей самий випуск.
(source: прод-`weekly_digests` live check 2026-08-21, `gh pr list`)

Власник **не був реальним гейтом якості**: `content_quality_report` score **82** з
чотирма blocking `language_mechanics`, і три з них **поїхали в прод-текст**
(`потокенно`, `frontier` у story 1; `вейферних` у story 7). Соцпакет
`612df95c-9c67-4db8-8f4b-209584d9ed68` згенеровано 17.08, пости scheduled на **24.08**
(+4 дні після сайту); LinkedIn лишався `in_review` після ручної правки 21.08.
(source: прод-`weekly_digest_artifacts` / `social_posts` live check 2026-08-21)

## Факти з прод-БД

- Створено **вручну** (`is_manually_created=true`) 16.08 05:53 UTC; 4 ревізії за один
  день (seed → swap stories → swap Radar → master output).
- Jobs: **15** `research_pack` succeeded; **1** master succeeded (~48 хв роботи після
  ~3 год waiting на packs); **10** `social_copy` failed / **2** succeeded; **1**
  `video_script` fail (`undefined.map`) + retry; **7** `story_image` + **2** `cover`
  succeeded.
- Ledger на цей digest: OpenRouter **$0.48** / 67 calls, vision **$0.07**. Гроші не
  були bottleneck.
- Preflight 20.08 став зеленим лише після двох прод-SQL фіксів: довільний `release_at`
  ([#305](https://github.com/sanchahous/ai-today-brief/pull/305)) і `threads` locale
  SQL vs TS ([#307](https://github.com/sanchahous/ai-today-brief/pull/307)) — Approve
  був **структурно неможливий з 23.07**.
- Чотири попередні weekly досі `in_review` і ніколи не вийшли (`07-20`, `07-26`,
  `07-27`, `08-02`).

Календар втрат: контент тижня 09–15 → сайт 20.08 → соц 24.08. Для news-продукту це
майже «минулий тиждень».

## Слабкі місця

### A. 28 кліків, нуль реального review

Шлях у [weekly-admin-runbook](../ops/weekly-admin-runbook.md) вимагав Approve на packs,
quality, articles, visuals, social, PDF, script. `review_status` був оркестраційним
mutex, не якісним вердиктом. `succeeded ≠ approved` свідомо тримав пайплайн, навіть
коли deterministic+critic уже сказали «ok».

**Корінь:** owner/RPC Approve `content_quality_report` не вимагав
`issues.filter(blocker).length === 0`. Тому `потокенно` поїхало в published revision.

### B. Контракт роз’їхався в трьох копіях

- SQL `weekly_digest_preflight` vs TS `WEEKLY_SOCIAL_MATRIX` (threads en/uk).
- Normalized `article` без `stories` → `undefined.map` у social (#278) і video_script
  (#297).
- Video Save писав Scene JSON поверх `narration_plan` (#299).
- LinkedIn 8 pages vs 7 (#293).

### C. Якість: гейти є, enforcement немає

`METADATA_MAX_CHARS.metaDescription = 160` існує в `content-studio.ts`, але published
EN/UK `metaDescription` = повний standfirst (тисяча+ символів). Critic дав
`suggestedFix` на `потокенно` → `потоково` — ніхто не застосував.

Public page мала JSON-LD `Article` (не `NewsArticle`), без `FAQPage`, без таблиці
метрик. Action board з’явився **після** релізу (21.08, #310).

### D. Visuals/video — не bottleneck

`prompt_only` + upload і shooting package лишаються на власнику за дизайном
([#240](https://github.com/sanchahous/ai-today-brief/pull/240)/[#301](https://github.com/sanchahous/ai-today-brief/pull/301)).
Прискорення: не блокувати PDF/social/script на зайвих Approve картинок; auto-approve
upload, якщо post-upload QA не `misleading` / dignity.

## CORE-EEAT / GEO (на опублікованому випуску)

**Сторінка:** `https://aitodaybrief.com/en/weekly/ai-weekly-2026-08-09`.  
**Вердикт якби аудитили перед ship:** **FIX** — критичних affiliate/clickbait veto
немає, але мовні блокери + meta overflow + відсутній FAQ/таблиця метрик.

- Contextual Clarity ~65 — сильний тижневий тезис (95B, не 2.4T), немає extractable
  FAQ.
- Organization ~75 — TOC, stories; немає data table 2.4T vs 95B / IBM 14–40% /
  HF 0/178.
- Referenceability ~70 — джерела й editor note; claim→source таблиці немає.
- Exclusivity ~60 — синтез є; practical був закопаний до Action board.
- Experience ~55 — news digest, не first-hand test.
- Expertise ~70 — vLLM/SGLang/MoE лексика ок.
- Trust ~65 — editor note + AI disclosure; випуск апрувлено з відомими мовними fail.

**GEO ~67, SEO (EEAT без A) ~63, weighted blog ~65 (Medium).**

**Content gap:** швидкість (TLDR закриває тиждень у день 0; ми на +5/+9); немає
concept-hubs на Qwen3.8 / ALTK-Evolve / PrivAiTe; schema не `NewsArticle`; 4
unpublished weekly = дірка continuity.

Галлюцинаційний ризик, який має бачити фінальна дошка: 2.4T / 95B / vLLM-SGLang;
IBM vs ACE «1/7 tokens»; HF «0 of 178»; PrivAiTe «2 of 24»; Anthropic 60 subagents /
36h; OpenAI 14× Cerebras. Усі мають бути з `claimId` → URL.

## Цільова машина (реалізовано 2026-08-21)

Один оркестратор, три людські зони. Деталі в [weekly-digest](../pipeline/weekly-digest.md)
і [weekly-admin-runbook](../ops/weekly-admin-runbook.md).

- **Машина:** selection → research ×3 → master → articles → pdf → social ×6 →
  video_script → video_manifest → prompts. Green gates → `review_status=approved`
  системою. Language `suggestedFix` застосовується до quality artifact. Meta ≤160
  на записі.
- **Власник Visuals:** copy prompt → зовнішній gen → upload. QA без
  misleading/dignity → auto-approve image. Без картинки немає релізу.
- **Власник Video:** Shooting package → кліпи → Remotion → paste YouTube id.
- **Єдине рев’ю:** вкладка Release → Hallucination board. Unresolved blockers =
  не можна Ship.

Соцслоти рахуються від `release_at` + channel offsets, не «наступний понеділок».

## Related pages

- [weekly-digest](../pipeline/weekly-digest.md)
- [weekly-admin-runbook](../ops/weekly-admin-runbook.md)
- [omni-channel-publishing-matrix](../marketing/omni-channel-publishing-matrix.md)
- [editorial-voice](../pipeline/editorial-voice.md)
- [now](../now.md)
