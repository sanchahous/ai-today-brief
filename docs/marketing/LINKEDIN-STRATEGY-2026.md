# LinkedIn-стратегія Sasha Kuzmenko / AI Today Brief

**Версія:** 1.0  
**Дата дослідження:** 18 липня 2026  
**Горизонт плану:** 90 днів  
**Статус:** стратегія і вимоги до CMS; без автоматичних змін у LinkedIn

> Цей документ замінює LinkedIn-специфічні поради з `SOCIAL-LAUNCH.md`. Загальні правила запуску Social CMS залишаються чинними, але рішення щодо форматів, посилань, cadence й автоматизації LinkedIn слід брати звідси.

## 1. Рішення в одному абзаці

Не потрібно вести три однакові LinkedIn-стрічки. **Особистий профіль** має стати головним каналом довіри, професійних розмов, найму та consulting leads. **Portfolio Company Page** — інституційним доказом: кейси, релізи, рекомендації, послуги й переходи на портфоліо. **AI Today Brief** — самостійним редакційним продуктом для builders: відібрані зміни, практичний вплив, щотижневі огляди й власні benchmarks. CMS має бути editorial operating system — зберігати джерела, готувати різні чернетки, перевіряти claims, формувати візуали, планувати та збирати аналітику. Але фінальний голос особистого профілю, коментарі, відповіді, connections і DMs залишаються ручними.

Найсильніша модель виглядає так:

```text
AI Today Brief створює інформаційний привід
                ↓
Sasha додає власний досвід, judgment і trade-offs
                ↓
Portfolio Page доводить здатність це реалізувати
                ↓
Profile / Service Page / website конвертують довіру в роботу
```

## 2. Що показав публічний аудит

### Особистий профіль

Публічно індексована версія [профілю Sasha Kuzmenko](https://www.linkedin.com/in/sashakuzmenko/) не відповідає поточному позиціонуванню сайту:

- headline і About досі концентруються на `Senior Frontend Developer`, React, Redux, Jest та remote work;
- поточна AI-діяльність і AI Today Brief не формують верхню частину профілю;
- Experience публічно закінчується airSlate у листопаді 2025 року;
- серед Skills залишаються застарілі для нового positioning 1C, Bitrix, Bootstrap, jQuery і PHP;
- водночас уже є дві сильні рекомендації про ownership, self-management, product metrics і soft skills;
- конкретний пост «зібрав локального AI-агента за 3 дні» отримав помітно сильнішу реакцію, ніж абстрактний пост про те, що agent має працювати не тільки в demo. Це невелика вибірка, але корисний сигнал: **artifact-first перемагає generic reflection**.

LinkedIn показав auth/security wall при прямому неавторизованому перегляді, тому перед редагуванням варто звірити цей аудит із поточним PDF export або screenshots профілю. Висновки про позиціонування при цьому не залежать від візуального оформлення.

### Portfolio Company Page

Публічна сторінка [Sasha Kuzmenko](https://www.linkedin.com/company/sashakuzmenko) зараз виглядає як друга версія людини, а не як practice/business:

- у tagline є випадковий префікс `A)` — його слід прибрати негайно;
- назва й опис не пояснюють, навіщо follow сторінку, якщо є особистий профіль;
- сторінка має стати перевірочним шаром для людини, яка вже розглядає найм або співпрацю.

### AI Today Brief

Публічна [Showcase Page](https://www.linkedin.com/showcase/aitodaybrief/) уже має чітку обіцянку: п’ятихвилинний AI-engineering brief про models, agents, MCP, developer tools і MLOps. Основні проблеми:

- display name `aitodaybrief` варто змінити на `AI Today Brief`;
- Showcase followers та analytics відокремлені від parent Page;
- Showcase не можна прив’язати до employment у профілі, jobs або Career Pages;
- за чинною довідкою LinkedIn Showcase з’являється у пошуку лише людям, які вже її follow.

Оскільки [AI Today Brief](https://aitodaybrief.com/en) має власний домен, продуктову обіцянку й потенціал окремого бренду, рекомендовано **конвертувати Showcase у standalone Company Page до активного росту**. LinkedIn дозволяє зберегти followers, posts і custom URL, але конвертація незворотна. Потрібно попередньо зберегти assets, перевірити admin access і зробити запит через LinkedIn Support. Залишати Showcase доцільно лише якщо AI Today Brief назавжди позиціонуватиметься як підрозділ Sasha Kuzmenko Studio.

### Сайт і proof assets

[Портфоліо](https://sashakuzmenko.com/en/) уже містить набагато сильніший доказовий матеріал, ніж LinkedIn-профіль:

- AI Today Brief: 120+ джерел, англійська й українська версії, human-edited pipeline;
- airSlate / USlegal: A/B outcomes `+65%` visits to choice, `+18%` payment success, `−5%` cancellations, а також інші вимірювані продуктові результати;
- ATB Orchestration Bench — потенційний proprietary benchmark і signature series;
- AI job-triage showcase — 670 findings, 124 dual verdicts, 51 human labels і чесно виміряний calibration bias;
- Social CMS — кейс responsible AI automation: AAL2 approval, content hashes, audit trail, critic, kill switches і reconciliation.

Перед активним розповсюдженням варто виправити три неузгодженості:

1. `Oleksandr` на сайті проти `Sasha` у LinkedIn. Обрати одну canonical public identity. Якщо для verification потрібне офіційне ім’я, використовувати його в name field, а Sasha — як зрозуміле additional/preferred name та послідовно пояснити в About.
2. Сайт говорить про 8 років, тоді як публічний LinkedIn timeline може сприйматися як понад 11 років. Не використовувати число в headline/About, доки не визначено, що саме рахується: весь web experience чи senior product/frontend experience.
3. Portfolio case описує Vite/React 18, тоді як поточний продукт уже Next.js 16/React 19. Також `80+ articles/day` треба уточнити як candidates scanned, а не published articles.

## 3. Чому ця модель відповідає LinkedIn у 2026 році

### Офіційно підтверджено

У березні 2026 року LinkedIn описав нове покоління Feed із LLM retrieval і sequential recommender. Система використовує:

- profile industry, experience, skills, headline, company і geography;
- семантичний зміст поста, author information, формат і metadata;
- історію конкретного читача: read, return, skip, click, like, comment, share;
- freshness у балансі з relevance;
- active та passive signals, включно з dwell time;
- affinity між читачем і автором.

Практичний наслідок: послідовна експертиза, повний профіль і самодостатній контент важливіші за «алгоритмічні hacks». Немає актуального офіційного підтвердження магічної ваги коментарів, «golden hour» або обов’язкового приховування link у першому коментарі.

LinkedIn також прямо розділяє ролі: profile — professional landing page людини та її personal brand; Page — присутність організації.

### Сильні, але observational сигнали

Metricool у 2026 році проаналізував 673,658 постів із 63,108 акаунтів. У вибірці personal profiles мали приблизно на 63% вищий engagement rate і значно більше comments; Pages — набагато більше shares. Це не randomized experiment, але воно підкріплює правильне розділення ролей: **людина починає розмову, Page створює стабільний і репостабельний proof**.

У тому ж dataset:

- native documents/PDF і multi-image були серед сильніших форматів;
- link posts на Company Pages корелювали з вищими impressions та interactions;
- link posts у personal profiles корелювали зі слабшими результатами.

Це не доказ link penalty. Правильне правило: personal post повинен давати цінність без кліку; Page може давати пряме корисне посилання. Не переносити автоматично всі links у first comment.

Buffer на вибірці понад 2 млн постів і 94 тис. акаунтів побачив покращення per-post reach та engagement при переході від одного до 2–5 постів на тиждень. Це аргумент за сталу регулярність, а не за максимальну частоту.

## 4. Архітектура трьох ідентичностей

| Поверхня | Головна аудиторія | Обіцянка | Контент | CTA | Стартовий cadence | Публікація |
|---|---|---|---|---|---|---|
| Personal profile | CTO, founders, hiring managers, senior engineers | «Я будую надійні AI-продукти й показую рішення, trade-offs та докази» | firsthand build logs, architecture, failures, product/frontend judgment, career | Hire, collaborate, discuss | 2/тиждень перші 2 тижні, потім 3 | CMS draft + обов’язковий ручний rewrite/approval + native scheduler |
| Portfolio Page | Люди, які вже перевіряють компетентність | «Ось системи, які реально shipped, і виміряні outcomes» | case studies, launches, demos, testimonials, services | View case, discuss project | 1/тиждень або 2 сильні/місяць | CMS + owner approval; native scheduler, API пізніше |
| AI Today Brief | AI builders, tech leads, founders | «Що змінилося, чому це важливо і що робити далі — без шуму» | selected news, editor verdict, weekly synthesis, tools, AOB | Follow, subscribe, read | 3–4/тиждень, один із них PDF | CMS + fact check + owner approval; low-risk API лише після стабілізації |

Не копіювати той самий текст між поверхнями. Одне інформаційне ядро повинно отримувати три різні редакційні кути:

| Asset | AI Today Brief | Personal | Portfolio |
|---|---|---|---|
| Social CMS | Що таке safe AI publishing і чому це важливо | Чому я відмовився від повного autopilot; знайдений failure mode | Architecture case: approval, hashes, audit, kill switch, reconciliation |
| ATB pipeline | Які sources і сигнали пройшли відбір | Яке product/engineering рішення я змінив після роботи з pipeline | Case study: problem → constraints → system → result |
| AOB run | Метод, результати, reproducible artifact | Власний verdict і те, що benchmark змінив у моєму підході | Повний technical case та downloadable report |
| airSlate outcome | Не публікувати: це не редакційна тема ATB | Урок про product judgment і A/B evidence | Case study з вимірюваним outcome та testimonial |

Крос-публікацію слід розводити на 24–48 годин. Особистий профіль може repost приблизно одного з п’яти важливих Page posts, але лише з новим контекстом, а не як порожній share.

## 5. Особистий профіль: positioning і conversion

### Рекомендована роль

Основний umbrella: **AI Product Engineer**. Senior Frontend Engineer — сильна доказова основа, а не стара ідентичність, яку треба приховати. `Forward Deployed Engineer` краще залишити серед target roles, доки немає окремого customer-facing case.

### Варіант headline для найму

> AI Product Engineer | Senior Frontend Engineer (React/TypeScript) | LLM products, agents, evals & developer tools | Creator of AI Today Brief | Remote EU

### Варіант headline для consulting

> I build reliable AI products — LLM apps, agents and developer tools | Senior React/TypeScript Engineer | Creator of AI Today Brief

Не намагатися вмістити всі ролі й technologies. Headline має відповісти на три питання: хто ти, що вмієш побудувати, який proof варто відкрити.

### Каркас About

```text
I build reliable AI products — from LLM pipelines and evals to the
user-facing systems around them — on a senior frontend/product engineering foundation.

Currently:
• Building AI Today Brief: 120+ sources monitored, EN/UA, human-edited.
• Publishing reproducible work on AI orchestration, evaluation and safe automation.
• Turning product constraints into measurable outcomes; at USlegal/airSlate,
  shipped experiments included +18% payment success and −5% cancellations.

I care about evidence, reliability, clear UX and honest trade-offs — not AI demos
that collapse outside the happy path.

Open to remote AI Product / Full-Stack AI / Senior Frontend roles and selected
product-engineering collaborations in Europe.

[one clear contact route]
```

Перед публікацією перевірити attribution кожної метрики й не створювати враження одноосібної заслуги, якщо результат був командним.

### Experience

- Додати поточний досвід `Creator & AI Product Engineer — AI Today Brief` із фактичними датами, scope і 2–4 доказами.
- Якщо ATB лишається Showcase, профіль не зможе прив’язати його як employment. Тоді тимчасово прив’язати роль до portfolio practice або додати як Project; після конвертації ATB у Company Page — асоціювати напряму.
- Додати `Independent AI Product Engineering` лише якщо це реальна поточна practice, а не aspirational label.
- AirSlate описати через scope, decisions і командні outcomes; не перетворювати Experience на список keywords.

### Featured

Залишити 3–5 найсильніших доказів у такому порядку:

1. AI Today Brief — live product / case study.
2. AirSlate / USlegal — measurable product outcomes.
3. Один завершений AOB benchmark run із репозиторієм і висновками.
4. AI job-triage showcase з calibration lesson.
5. Найкращий особистий build-in-public post або Social CMS case.

Не ставити в Featured багато однотипних links. Кожна картка має доводити іншу частину positioning.

### Skills, recommendations і conversion controls

- Підняти нагору: AI Product Engineering, LLM Applications, AI Agents, Evaluation, TypeScript, React, Next.js, Product Engineering, System Design, Supabase/Postgres, Accessibility — лише те, що можна підтвердити.
- Старі 1C/Bitrix/jQuery не обов’язково видаляти, але вони не повинні визначати перший екран Skills.
- Попросити 3 нові recommendations: одну про product ownership, одну про technical leadership, одну про співпрацю/надійність. Дати кожній людині контекст, але не писати текст за неї.
- Для пошуку роботи — `Open to Work: recruiters only` із вузьким списком target roles.
- Для consulting — спочатку LinkedIn Service Page. Premium custom CTA може замінити Services button, тому обирати відповідно до головної цілі, а портфоліо все одно тримати у Featured і Contact Info.

## 6. Контент особистого профілю

### Піллари

| Частка | Піллар | Приклади |
|---:|---|---|
| 35–40% | Building AI products in public | ATB, Social CMS, job triage, AOB, demos, decision logs |
| 25–30% | Production AI engineering | evals, reliability, costs, human gates, orchestration, postmortems |
| 20–25% | Senior product/frontend judgment | architecture, UX, experiments, accessibility, shipping trade-offs |
| 10–15% | Career, leadership, availability | frontend→AI transition, team practices, role/consulting offer |

### Формула сильного personal post

```text
Specific hook: що сталося або що я спочатку вважав правильним
→ context: реальний продукт/обмеження
→ artifact/evidence: screenshot, number, diagram, code, run або failure
→ decision: що саме я змінив
→ trade-off: що це коштувало або де не спрацює
→ takeaway: коротке правило для practitioner
→ one specific question: лише якщо він природно продовжує тему
```

Тон: senior, proof-first, спокійний, конкретний. Не використовувати фальшиву vulnerability, «AI changes everything», надмірні emoji, reaction polls або generic engagement bait.

### Перші шість тем

1. Що зробило локального AI-agent робочим за три дні — з demo/artifact і обмеженнями.
2. Чому agent, який працює лише у demo, не є product feature — на прикладі одного реального failure mode.
3. 51 human label і calibration bias: що job-triage system змусила мене змінити.
4. Чому в Social CMS є AAL2 approval, content hash і kill switch замість повного autopilot.
5. Як senior frontend background допомагає будувати кращі AI products: state, latency, failure UX, accessibility.
6. Один airSlate decision: constraint → experiment → measured outcome → lesson, із коректним командним attribution.

## 7. Portfolio Page: не «друга людина», а proof practice

### Рекомендоване оформлення

**Назва:** `Sasha Kuzmenko — AI Product Engineering`  
**Tagline:** `Independent AI product engineering: LLM apps, agents and developer tools — from prototype to production.`  
**CTA:** portfolio case studies або contact form, залежно від готовності до leads.

Не називати practice «agency», якщо немає відповідної operating model. `Studio` або `Independent AI Product Engineering` достатньо.

### Контент

- case study: problem → constraints → decision → implementation → measurable result;
- product demo або release milestone;
- короткий testimonial із контекстом роботи;
- service offer із чітким scope, кому підходить і кому ні;
- occasional behind-the-scenes engineering process.

English-only протягом перших 90 днів. Один сильний post/week достатній; якщо матеріалу не вистачає, краще два доказові пости на місяць, ніж чотири generic.

### Перші п’ять seed posts

1. USlegal/airSlate case у native PDF: problem, architecture, experiment, outcomes.
2. AI Today Brief architecture: 120+ sources → candidate filtering → human review → EN/UA delivery.
3. Social CMS responsible automation: approval, hashes, audit, kill switches, reconciliation.
4. `What I build` — три конкретні offers з прикладами deliverables, не список buzzwords.
5. Recommendation / working-style proof: ownership, product metrics і collaboration.

## 8. AI Today Brief: editorial product, а не link dump

### Рекомендоване оформлення

**Display name:** `AI Today Brief`  
**Tagline:** `AI-engineering signal for builders: models, agents, MCP, dev tools and MLOps that matter — in 5 minutes.`  
**Category phrase:** постійно використовувати `AI-engineering signal for builders`, бо назва конкурує з кількома generic AI brief brands.

### Контент-піллари

- одна важлива зміна: факт → чому це важливо → для кого → source;
- weekly `5 moves that changed how builders work` у native PDF;
- practical tool comparison із критеріями, а не affiliate-style ranking;
- editor’s verdict, чітко відокремлений від факту;
- AOB benchmark run із protocol і reproducible artifacts;
- editorial methodology, correction і transparency notes.

Публікувати 3–4 рази на тиждень; один пост може бути weekly document. Це реалістичніший solo cadence, ніж щоденні 5–6 posts. Після стабільної production capacity можна підняти частоту.

### LinkedIn newsletter

Запускати **один** LinkedIn newsletter — weekly edition AI Today Brief — після виконання Page eligibility: понад 150 followers/connections, recent original content і good standing. Не запускати portfolio newsletter. Personal newsletter розглядати лише пізніше, якщо з’явиться стабільна й відмінна editorial promise на кшталт `Shipping reliable AI products`.

### Showcase → Company Page: decision gate

| Залишити Showcase | Конвертувати в standalone Company Page |
|---|---|
| ATB назавжди є initiative portfolio practice | ATB — самостійний продукт і бренд |
| не потрібні employment association, jobs або ширша search discovery | потрібні profile employment, незалежна discovery, майбутня команда/партнери |
| важливіша parent affiliation | важливіша автономність бренду |

**Рекомендація:** конвертувати. До запиту в Support:

1. Перевірити, що Sasha має super admin access до потрібних Pages.
2. Зберегти Page assets, опис, links і список ключових posts.
3. Узгодити canonical name, handle, logo і website.
4. Попросити зберегти affiliation із parent Page, якщо вона ще потрібна.
5. Пам’ятати, що операція незворотна, хоча followers/posts/custom URL мають зберегтися.

## 9. Мова, формати, посилання й час

### Мова

- Personal: стартова гіпотеза `70–80% English / 20–30% Ukrainian`, бо головна business-ціль — international/EU hiring і collaboration.
- Portfolio Page: English-only перші 90 днів.
- AI Today Brief LinkedIn: English-first. Окремий Ukrainian weekly digest тестувати лише після накопичення analytics.
- Один post — одна мова. Не публікувати дві повні перекладені версії в одному полотні й не дублювати той самий post двічі поспіль.

### Формати

- Personal: text + artifact, screenshot, architecture diagram, short demo; PDF раз на 1–2 тижні.
- Portfolio: case-study PDF, multi-image process, demo video, testimonial card.
- ATB: concise brief, comparison table, weekly native PDF, occasional short editor video.

Organic `carousel` у LinkedIn — це зазвичай завантажений multi-page PDF/document. Окремий carousel type в API стосується sponsored content; для organic CMS має генерувати Document.

### Посилання

- Personal: post має бути повністю корисним без переходу. Link додавати, коли він є реальним next step.
- Portfolio й ATB: прямий link у post допустимий і часто природний.
- Не ховати всі links у first comment за універсальним правилом.
- Використовувати identity-specific UTM, наприклад:

```text
utm_source=linkedin
utm_medium=organic_social
utm_campaign=personal_brand | portfolio_proof | atb_editorial
utm_content={package}.{pillar}.{format}.{language}
```

### Час

Немає універсального best time. Протягом 6–8 тижнів A/B тестувати два вікна для Europe/US tech audience:

- 11:00–13:00 Kyiv;
- 16:00–18:00 Kyiv.

Порівнювати medians за однаковим identity, pillar і format. Не робити висновок після одного viral post.

## 10. Ручна репутаційна робота

Контент без професійної взаємодії не сформує потрібну мережу. Чотири дні на тиждень виділяти по 15 хвилин:

1. Три substantive comments за сесію.
2. Коментувати лише там, де є реальна technical/product думка.
3. Працювати зі списком із 30 target accounts: 10 hiring/founder/CTO, 10 сильних practitioners, 10 AI tools/media/partners.
4. Писати comment як micro-post: конкретний досвід, counterexample, framework або корисне питання.
5. Відповідати на змістовні коментарі під власним постом того ж дня, але без штучного «підняття engagement».

Не автоматизувати likes, comments, replies, reposts, follows, connection requests або DMs. LinkedIn прямо забороняє scraping/browser automation, fake engagement, pods і high-volume repetitive activity.

## 11. Як CMS має працювати з трьома LinkedIn-ідентичностями

### Поточне обмеження

Поточна схема безпечно моделює лише одну LinkedIn identity:

- `social_accounts.channel` унікальний на рівні `linkedin`;
- `social_posts` дозволяє лише один post на package/channel;
- OAuth secret зберігається один на весь channel, а flow запитує organization publishing scope;
- LinkedIn provider публікує через один `urn:li:organization:*`; member author не підтримується;
- composer має один LinkedIn variant, один voice/template й один UTM source;
- source model розуміє approved ATB news, але не firsthand note, case study, build log або career claim;
- візуали жорстко брендовані AI Today Brief і не підтримують native PDF/document;
- native scheduler link фактично орієнтований на AI Today Brief;
- metrics schema/dashboard існують, але collector/import job ще не реалізований.

Тому **до multi-identity redesign CMS слід використовувати для прямого LinkedIn delivery тільки AI Today Brief**. Personal і Portfolio можуть отримувати чернетки/assets через manual handoff.

Початкові destination keys для конфігурації:

| `account_key` | Поточна адреса/ID | Стартовий mode |
|---|---|---|
| `personal` | `linkedin.com/in/sashakuzmenko` | `manual` |
| `portfolio` | Company admin ID `133983903` | `manual` |
| `aitodaybrief` | Showcase admin ID `133973918` | `manual`, потім limited API |

Admin ID не слід автоматично вважати готовим author URN. Після OAuth/API lookup потрібно зберегти та показати exact destination name/URN для підтвердження; після Showcase conversion — повторно його визначити.

### Цільова модель даних

Не додавати псевдоканали `linkedin_personal`, `linkedin_portfolio` і `linkedin_atb`. Network, credentials і destination — різні сутності.

`social_connections`:

- `provider`, `scopes`, `secret_reference`, `token_expires_at`;
- одна authorization може керувати кількома дозволеними organization destinations, але права перевіряються окремо.

`social_destinations` / publisher identity:

- `id`, `network`, `account_key`;
- `account_kind`: `person | organization | showcase`;
- `connection_id`, `external_account_id`, `author_urn`, `display_name`;
- `voice_profile`, `audience`, `default_language`, `default_cta`;
- `publication_mode`: `manual | native_scheduler | official_api`;
- `public_url`, `admin_url`, `enabled`, destination-level kill switch;
- unique `(network, account_key)`, а не лише `channel`.

`social_posts`:

- `publisher_identity_id`;
- `pillar`, `objective`, `format`, `language`;
- `source_refs`, `claim_provenance`, `firsthand_evidence`;
- `risk_class`, `experiment_id`, `utm_content`;
- `published_url/urn`, `published_at`, analytics snapshots;
- unique `(package_id, publisher_identity_id)`.

`publisher_identity_id`, exact author URN, publication mode і destination version мають входити в approval/content hash. Інакше зміна account config після approval потенційно може відправити вже схвалений текст не тому отримувачу.

Додатковий `content_brief` має розрізняти `approved_news | firsthand_note | case_study | build_log | opinion`, зберігати evidence/metrics, confidentiality, reputation risk і окремий angle/CTA для кожної destination.

### Identity-specific gates

| Identity | Обов’язкова умова |
|---|---|
| Personal | `firsthand_evidence` заповнене; модель не має права вигадувати особистий досвід, думку, failure або claim про командну заслугу |
| Portfolio | кожна метрика має provenance; case не подається як shipped, якщо він planned/in progress |
| ATB | source URL, publication/event date, fact vs interpretation, freshness check і correction route |

### Manual handoff у CMS

Для personal і portfolio package має давати:

- `Copy draft`;
- download image/PDF;
- alt text;
- source/evidence panel;
- identity checklist;
- deep link до native scheduler;
- поле для pasted published URL/URN;
- нагадування імпортувати analytics.

Для `publication_mode=manual` delivery worker не має права claim/publish post. Оператор окремо позначає `scheduled`, а після фактичної публікації — `published` із URL/URN. Це не дозволить CMS помилково вважати handed-off чернетку доставленою.

### Безпечний workflow

```text
Research / canonical fact set
→ identity-specific drafts
→ source, claim, date, duplication and voice checks
→ human approval
→ native scheduler or official API
→ published URL + UTM reconciliation
→ 48h / 7d / 30d analytics
→ editorial learning
```

### Де API доречний

- Personal: залишити ручний final pass і native scheduler навіть за наявності `w_member_social`.
- Portfolio Page: official API після окремого identity support і LinkedIn Community Management approval.
- ATB: спочатку owner approval; low-risk approved templates можна автоматизувати пізніше.
- Жодних browser bots. Лише native scheduler або official OAuth/API.

LinkedIn Community Management API є vetted product із Development/Standard access, legal/business verification і limits. Стратегія не повинна залежати від отримання Standard access у конкретну дату.

### Gate для low-risk auto-publish ATB

Не раніше ніж після:

- 30 послідовних днів shadow/approved delivery;
- перевіреного kill switch і reconciliation;
- відсутності unsupported claims, wrong-account posts та stale-source incidents;
- щонайменше 90% drafts, прийнятих із не більш ніж одним minor edit за останні 30 днів;
- окремого allowlist шаблонів.

Навіть після цього editor verdicts, breaking/sensitive news, corrections і personal content залишаються human-approved.

### Технічний rollout і acceptance criteria

1. **Destinations + manual handoff:** три destinations, три voice/evidence lanes, correct native destination link, manual posts never claimed by worker.
2. **Safety binding:** destination/URN/version входять у hash; зміна destination відкликає approval; wrong-URN prevention test.
3. **Assets:** окремі brand presets і підтримка LinkedIn Document/PDF, alt text та download bundle.
4. **Analytics:** ручний 48h/7d XLSX import спочатку, API collector пізніше; UTM та qualified outcome на рівні destination.
5. **Shadow:** 20–30 drafts на identity, edit-rate gate `≥90%` із не більш ніж однією короткою правкою.
6. **Limited API:** підключати по одній destination — ATB, потім Portfolio — з test post, exact URN verification, AAL2 approval і destination kill switch.
7. **Personal manual by default:** навіть коли member publishing технічно доступний.

Existing social unit tests проходять, але перед multi-identity delivery потрібні integration tests для three-destination routing, manual-post claim prevention, approval invalidation, AAL1/AAL2 mutations і concurrent worker claim.

## 12. 90-денний план

### Дні 0–7: foundation

- виправити `A)` у Portfolio tagline;
- перейменувати `aitodaybrief` на `AI Today Brief`;
- вирішити й запустити Showcase → Company Page conversion;
- узгодити Sasha/Oleksandr, headline, About, current Experience, years і exact metrics;
- оновити Skills та Featured;
- налаштувати recruiter-only Open to Work або Service Page відповідно до головної цілі;
- зробити baseline export personal/Page analytics за доступні періоди;
- створити target list 30 accounts;
- підготувати по 3–5 seed posts для обох Pages до активних follow invitations;
- у CMS додати identity plan, але не ламати поточний single-account delivery.

### Дні 8–30: controlled publishing

- Personal: 2 posts/week перші два тижні, потім 3 за наявності proof;
- Portfolio: 1 post/week;
- ATB: 3–4 posts/week, включно з weekly document;
- CMS працює в shadow/manual-approval режимі;
- чотири ручні comment sessions/week;
- тестувати два time windows, 2–3 формати й language mix;
- кожен post отримує identity, pillar, objective, UTM і 48h result.

### Дні 31–60: authority assets

- опублікувати перші завершені AOB runs із reproducible artifacts;
- перетворити Social CMS або job-triage calibration на flagship personal/portfolio case;
- попросити три targeted recommendations;
- запустити weekly ATB newsletter, якщо Page eligible;
- відмовитися від тем, які дають vanity reach без цільової аудиторії;
- спроєктувати multi-identity schema та manual handoff; не вмикати unattended personal delivery.

### Дні 61–90: scale what converts

- подвоїти увагу до двох найсильніших personal pillars і форматів;
- опублікувати один flagship native document або deep case;
- Page API вмикати лише за official access і пройдених QA gates;
- провести 10–15 contextual conversations із людьми, які вже взаємодіяли з proof content; без mass outreach;
- підбити 90-day review: qualified conversations, interviews, calls, referrals, subscriptions і attributable site actions.

## 13. Приклад робочого тижня

| День | Personal | Portfolio | AI Today Brief | Manual network work |
|---|---|---|---|---|
| Пн | — | — | one important change | 15 хв comments |
| Вт | build note + artifact | — | short practical brief | replies |
| Ср | — | case study / proof | — | 15 хв comments |
| Чт | framework або postmortem | — | tool/change analysis | 15 хв comments |
| Пт | optional third post: career/lesson | — | weekly PDF | 15 хв comments + weekly review |

Це редакційний rhythm, а не жорсткі дні. Якщо немає доказу або власної думки, personal slot краще пропустити, ніж заповнити generic AI content.

## 14. Вимірювання

### North star

**Qualified outcomes**, а не impressions:

- релевантні recruiter/client DMs;
- interviews, discovery calls, referrals, offers;
- senior practitioners, founders або hiring managers, які зберегли, надіслали чи змістовно прокоментували;
- attributable portfolio/contact conversions;
- ATB subscribers і returning readers.

### Personal

- out-of-network share і members reached;
- saves, sends, substantive comments;
- profile viewers/followers from post;
- viewer demographics: role, seniority, company, industry;
- search appearances;
- qualified conversations, interviews, calls, offers.

### Portfolio

- CTA/link clicks і case-study visits;
- followers gained та їх demographics;
- contact/service inquiries;
- attributable website conversion.

### AI Today Brief

- saves, sends, reposts і out-of-network reach;
- link visits і site signup;
- newsletter subscribers;
- returning readers;
- partnerships, citations або source/author interaction.

### Review cadence

- 48h: первинний distribution і реакції;
- 7d: повний post result та profile/site action;
- 30d: pillar/format/language/time medians;
- 90d: business outcomes.

Імпортувати personal combined analytics через XLSX; Page analytics — API або XLSX. Comments можуть мати власні impressions, але залишаються ручною діяльністю. Не оптимізувати систему за одним viral outlier.

## 15. Репутаційні guardrails

1. Не вигадувати firsthand experience, failures, opinions або customer outcomes.
2. Відокремлювати факт, inference і власний verdict.
3. Для AI news зберігати першоджерело та event/publication date.
4. Не перебільшувати team contribution; використовувати `I` і `we` точно.
5. Planned work завжди позначати як planned/in progress.
6. Heavy AI assistance розкривати, якщо без disclosure походження контенту може бути неочевидним; автор усе одно несе відповідальність.
7. Не використовувати scraping, browser automation, auto-comments, auto-DMs, auto-connections, pods або purchased engagement.
8. Не копіювати чужі articles. Цитувати коротко, переказувати власними словами, давати source.
9. Публічно й швидко виправляти фактичні помилки; вести correction log для ATB.
10. Не віддавати CMS пароль LinkedIn; тільки official OAuth/API.

## 16. Benchmarks для стилю, не для копіювання

- [Gergely Orosz](https://www.linkedin.com/in/gergelyorosz/) — personal engineering authority живить окремий editorial product; recurring formats і firsthand research.
- [Addy Osmani](https://www.linkedin.com/in/addyosmani/) — frameworks і engineering deep dives замість generic tips.
- [Simon Willison](https://www.linkedin.com/in/simonwillison/) — working demos, code, costs, experiments і failure notes; найкращий орієнтир для artifact-first credibility.
- [Rowan Cheung](https://www.linkedin.com/in/rowancheung/) + [The Rundown AI](https://www.linkedin.com/company/the-rundown-ai/) — чітке розділення founder identity і high-frequency media utility.

Копіювати варто operating principles — specificity, evidence, recurring formats, clear identity — а не чужий tone of voice.

## 17. Джерела дослідження

### LinkedIn — офіційні

- [Profile vs Page](https://www.linkedin.com/help/linkedin/answer/a6242790)
- [Showcase Pages: feature comparison](https://www.linkedin.com/help/sales-navigator/answer/a570165)
- [Showcase FAQ](https://www.linkedin.com/help/linkedin/answer/a567185)
- [Showcase → Company Page conversion](https://www.linkedin.com/help/linkedin/answer/a553432)
- [Next-generation LinkedIn Feed, 12.03.2026](https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed)
- [Dwell time in Feed](https://www.linkedin.com/blog/engineering/feed/leveraging-dwell-time-to-improve-member-experiences-on-the-linkedin-feed)
- [Personal post analytics](https://www.linkedin.com/help/linkedin/answer/a516971)
- [Combined member analytics](https://www.linkedin.com/help/linkedin/answer/a701208)
- [Page content analytics](https://www.linkedin.com/help/linkedin/answer/a564052)
- [Newsletter creation](https://www.linkedin.com/help/linkedin/answer/a524002)
- [Page newsletter eligibility](https://www.linkedin.com/help/linkedin/answer/a596269/)
- [Schedule personal posts](https://www.linkedin.com/help/linkedin/answer/a1347212)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-06)
- [Community Management API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview?view=li-lms-2026-06)
- [Prohibited software and automation](https://www.linkedin.com/help/linkedin/answer/a1341387)
- [Professional Community Policies](https://www.linkedin.com/legal/professional-community-policies)
- [AI-generated content best practices](https://www.linkedin.com/help/linkedin/answer/a1481496)

### Незалежні datasets — використовувати як гіпотези, не algorithm law

- [Metricool LinkedIn Study 2026 — 673,658 posts / 63,108 accounts](https://metricool.com/wp-content/uploads/Linkedin-Study-2026-EN.pdf)
- [Buffer frequency study — 2M+ posts / 94K accounts](https://buffer.com/resources/how-often-to-post-on-linkedin/)
- [Socialinsider LinkedIn content benchmark](https://www.socialinsider.io/social-media-benchmarks/linkedin)
- [Edelman–LinkedIn 2025 B2B Thought Leadership report](https://www.edelman.com/expertise/Business-Marketing/2025-b2b-thought-leadership-report)

## 18. Найближчі сім рішень

1. Вибрати primary 90-day goal: hiring first, consulting first або одна пріоритетна/одна secondary; headline і CTA мають це відображати.
2. Підтвердити canonical name та точне формулювання experience/years.
3. Виправити Portfolio tagline і перейменувати Page як practice.
4. Перейменувати AI Today Brief і подати запит на Showcase → Company conversion.
5. Перебудувати верх профілю: headline, About, current Experience, Featured, Skills.
6. Підготувати 14-денний seed calendar і evidence/assets для кожного post.
7. Залишити CMS у hybrid mode: ATB — керований delivery, Personal/Portfolio — manual handoff; multi-identity automation будувати лише після schema redesign.
