# AEO strategy — бути цитованим відповіддю

Summary: стратегія Answer Engine Optimization (Perplexity/ChatGPT/Gemini/Copilot): чому dev-ніша виграє від структурування під extraction, які механізми сайту вже працюють на AEO і як міряти результат.
Sources: `.cursor/rules/00-core.mdc` §SEO/AEO, [strategy/master-roadmap](../strategy/master-roadmap.md) L3, [on-site-audit-2026-08-21](on-site-audit-2026-08-21.md)
Last updated: 2026-08-21

---

## Чому AEO — першокласний канал для ATB

Dev-аудиторія шукає в Perplexity/ChatGPT так само часто, як у Google. Відповідь-машина
цитує джерела, які (а) структурно придатні для extraction, (б) мають атрибутовані факти,
(в) свіжі. Для нишевого брифу це дешевший шлях до авторитету, ніж змагатись із
мас-медіа в класичному SERP. Теза зафіксована ще в
[master-roadmap L3](../strategy/master-roadmap.md).

## Механізми сайту, що працюють на AEO (стан 2026-08-21)

| Механізм | Де | Що дає |
|---|---|---|
| Definition block у перших ~300 словах (source: `.cursor/rules/00-core.mdc` §SEO/AEO) | концепти, гайди | Модель витягує готове визначення |
| `llms.txt` (source: live check `/llms.txt` 2026-08-21) | `/llms.txt` | Карта сайту для LLM-краулерів: ключові сторінки обох мов, фіди, правила цитування |
| JSON-LD на кожному типі сторінки (source: [on-site-audit](on-site-audit-2026-08-21.md)) | NewsArticle / TechArticle / WebApplication / FAQPage / BreadcrumbList / Organization+WebSite | Машинна верифікація сутностей; FAQPage дає Q/A-пару «як є» |
| Один вузол на URL | фікс B3 з [on-site-audit](on-site-audit-2026-08-21.md) | Дублі схеми змушують Google вибирати довільно — тепер вибору немає |
| Чесний lastmod/dateModified | sitemap + Article schema (B10, там само) | Свіжість — сигнал ранжування відповідей; брехливий lastmod карається недовірою |
| RSS обома мовами | `/rss.xml`, `/rss-uk.xml` (B6, там само) | Фіди — прямий канал споживання для агентів і рідерів |
| Автолінки між концептами | `linkConceptMentions` (B9, там само) | Граф внутрішніх лінків = граф сутностей для extraction |
| robots.txt пускає AI-ботів (source: `src/app/robots.ts`) | GPTBot/PerplexityBot/ClaudeBot/Google-Extended | Без цього все вище не має сенсу |

## Правила контенту (для редакції й генераторів)

1. Перше речення хаба/гайда — самодостатнє визначення терміну.
2. Порівняльні таблиці > прози, коли є ≥2 альтернативи.
3. Кожна цифра — з атрибуцією та датою; без дати число не цитують.
4. FAQ-блок там, де є реальні питання пошуку (не вигадані).
5. UK-версія — повний переказ, не скорочення: моделі змішують мови запиту.

## Як міряти

- Реферали від AI-систем у GA4 (`session source` ∈ perplexity.ai, chatgpt.com, …) —
  базова лінійка до появи: direct/none (assumption). Події див.
  [event-taxonomy](../analytics/event-taxonomy.md).
- Ручна проба раз на місяць: 5 типових dev-запитів ніші в Perplexity/ChatGPT → чи є ATB
  у цитатах (фіксувати в log).
- GSC: зростання impressions по long-tail питаннях — провісник AEO-цитувань
  (source: [2026-07-01-seo-organic](../audits/2026-07-01-seo-organic.md)).

## Related pages

- [on-site-audit-2026-08-21](on-site-audit-2026-08-21.md) — технічні фікси, на яких стоїть ця стратегія
- [../analytics/event-taxonomy](../analytics/event-taxonomy.md) — чим міряємо
- [../strategy/master-roadmap](../strategy/master-roadmap.md) — місце AEO в роадмапі (L3)
