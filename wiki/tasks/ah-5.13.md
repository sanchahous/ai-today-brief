# AH-5.13

Summary: Статусний фрагмент AH-5.13. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405, PR #430
Last updated: 2026-10-05

---

Task: ah-5.13

## Status

### epic-5.3

```verbatim
| AH-5.13 | Subscribe і Advertise | M | агент + власник | AH-5.1, AH-3.4 | routes `subscribe`, `advertise` |
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405), [PR #430](https://github.com/sanchahous/ai-today-brief/pull/430))

## Updates
- 2026-10-05: Реалізовано After Hours редизайн сторінок `subscribe` та `advertise` (AH-5.13, PR #430).
  - `src/app/[lang]/subscribe/page.tsx`: split-layout (`.subscribe-layout`), H1, лід, `NewsletterForm variant="full"` із вибором мови (EN/UK), обов'язковою згодою та текстом помилок; праворуч aside `.sample-issue` з реальним останнім щоденним випуском (4 записи через `getSubscribeSampleEdition`); сітка 4 переваг `SubscribeBenefitsGrid` з токенами без сирих кольорів; FAQ-акордеон з підтвердженим розкладом (пн–сб щоденні, пн тижневий) та валідним JSON-LD `FAQPage`.
  - `src/components/subscribe-sample-list.tsx`: After Hours картка прикладу випуску з номерами 01–04, бейджами категорій (безпечний прокид slug/color для AST-перевірки категорійних кольорів), посиланням на `/digests`.
  - `src/components/subscribe-benefits-grid.tsx`: 4 підтверджені переваги, дизайн-токени без сирих значень.
  - `src/lib/subscribe-page.ts`: типізована функція вибірки останнього щоденного випуску через `getLatestBrief` із фолбеком на `getHomeData`.
  - `src/app/[lang]/advertise/page.tsx`: After Hours інтро, єдиний H1, 3 реальні формати слотів з `AD_INVENTORY` (`marketing-content.ts`), CTA-блок із `ADVERTISE_EMAIL` (`sponsor_inquiry_click`), повне усунення неперевірених показників аудиторії та сирих кольорів.
  - `src/components/advertise-inquiry-cta.tsx`: mailto посилання з темою `Media%20kit`, аналітика та класи кнопок After Hours.
  - `src/lib/marketing-content.ts`: оновлено 4 переваги підписки, 3 FAQ, 3 формати розміщення спонсорства; збережено зворотну сумісність.
  - Скорочено baseline сирих значень через `npm run design:raw:prune`.
  - Unit-тести `src/lib/subscribe-page.test.ts` та `src/lib/marketing-content.test.ts` пройдено (9 тестів).
  - Повний гейт `npm run pr:check` пройдено на 100% зелено. SEO-diff 0 проти baseline на обох маршрутах.
- 2026-10-05 (repair T1-f1): Push відхилено через флейк `net::ERR_NO_BUFFER_SPACE` у `e2e/a11y-layout-matrix.spec.ts` (`news-search-q-uk uk day 390`) — Windows-ресурс під навантаженням 272+ E2E, не регресія subscribe/advertise. Targeted retry тесту пройшов; повторний `npm run pr:check` (PORT=3104) — exit 0. Змін коду не потрібно.
