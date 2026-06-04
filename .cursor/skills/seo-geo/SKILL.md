---
name: seo-geo
description: >-
  SEO та GEO аудит для sashakuzmenko.com. Маршрутизує до 20 skills з
  aaron-he-zhu/seo-geo-claude-skills (.agents/skills/). Використовуй для
  on-page/technical SEO, schema, meta tags, entity/CITE, GEO оптимізації.
---

# SEO / GEO Skills — sashakuzmenko.com

## Джерело

Skills встановлені з [aaron-he-zhu/seo-geo-claude-skills](https://github.com/aaron-he-zhu/seo-geo-claude-skills) у `.agents/skills/`. Lock-файл: `skills-lock.json`.

## Властивості домену

| URL | Тип | Примітки |
|-----|-----|----------|
| `https://sashakuzmenko.com/` | Статичний HTML + Vite | Портфоліо, EN/UA через JS |
| `/ai-news-scrapper/` | Vite SPA | Контент з Supabase, EN/UK |
| `/study-platform/` | Vite SPA | Auth-захищений, приватний |

## Який skill коли

| Задача | Skill (`.agents/skills/…`) |
|--------|---------------------------|
| Повний технічний аудит | `technical-seo-checker` |
| On-page (title, H1, meta, images) | `on-page-seo-auditor` |
| Meta / OG / Twitter / canonical | `meta-tags-optimizer` |
| JSON-LD (Person, WebSite, Article) | `schema-markup-generator` |
| Довіра домену (CITE 40-item) | `domain-authority-auditor` |
| Knowledge Graph / entity | `entity-optimizer` |
| Контент для AI Overview / LLM | `geo-content-optimizer` |
| Якість контенту (CORE-EEAT) | `content-quality-auditor` |
| Внутрішні посилання | `internal-linking-optimizer` |
| Ключові слова | `keyword-research` |
| SERP / конкуренти | `serp-analysis`, `competitor-analysis` |

## Workflow аудиту

1. **Technical** — robots.txt, sitemap, canonical, crawl/index, CWV, AI crawlers.
2. **On-page** — кожна властивість окремо (головна, AI Brief, Study Platform).
3. **Schema + Entity** — Person/WebSite для портфоліо; NewsArticle/ItemList для брифів.
4. **GEO** — цитованість, FAQ-блоки, definitional sentences, видимий контент у HTML.
5. **CITE** — domain-authority-auditor для довіри та sameAs (GitHub, LinkedIn).

## Відомі пріоритети (останній аудит)

- P0: `sitemap.xml` → 404 при наявному рядку в robots.txt
- P0: `og-image.png` → 404
- P1: немає JSON-LD на головній
- P1: hreflang/x-default для EN/UA на портфоліо
- P1: AI Brief — CSR-контент, немає per-page OG/schema
- P2: Study Platform — meta description, `noindex` для приватного застосунку

Повний звіт: canvas `canvases/seo-audit.canvas.tsx`.

## Оновлення skills

```bash
npx skills add aaron-he-zhu/seo-geo-claude-skills -y
```
