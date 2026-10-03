# telegram-linkedin-1-2026-08-21-ai-weekly-2026-08

Summary: Статусний фрагмент telegram-linkedin-1-2026-08-21-ai-weekly-2026-08. Текст нижче перенесено дослівно зі спільних списків; подальший статус цієї задачі пишеться лише в цей файл.
Sources: перенос зі спільних списків, ATB-67, PR #405
Last updated: 2026-10-03

---

Task: telegram-linkedin-1-2026-08-21-ai-weekly-2026-08

## Status

### now.md

```verbatim
- **Соц-копія тепер зобовʼязана давати дію; Telegram рендерить розмітку; LinkedIn-лінк
  переїхав у 1-й коментар (2026-08-21).** Розбір релізу `ai-weekly-2026-08-09` проти прод-БД
  показав, що «сухість» постів — не стиль, а відсутній блок: `practical_*` заповнене в усіх
  7 історій і вже передавалось письменнику, але промпт його не просив. `CHANNEL_CONTRACT`
  тепер вимагає верстки й практики (діє і на письменника, і на критика); Telegram шлеться з
  `parse_mode: HTML` через whitelist-конвертер; ті самі маркери заборонені в решті каналів
  (`raw_markup`); `linkedin.rootUrlStrategy` → `'none'` + автопостинг `firstComment`;
  `/r/s/[token]` віддає ботам 200 HTML з OG замість 302 `no-store` і більше не рахує
  скрапери як кліки (було 34 з 42). На сайті: новий блок «Що взяти в роботу цього тижня»
  під героєм і **відео перенесено з кінця статті на початок**.
  **Не перевірено наживо:** скрапер Facebook (Sharing Debugger після деплою) і рендер
  розмітки в Telegram (поточна копія її не містить — перший чесний тест на випуску 23.08).
  LinkedIn пакету `612df95c` після ручної правки 21.08 знову `scheduled` на 24.08 16:10 Kyiv
  (відновлено `content_hash`, approval_version=content_version).
  (source: [marketing/omni-channel-publishing-matrix](marketing/omni-channel-publishing-matrix.md),
  прод-`social_posts` / `social_click_events` live check 2026-08-21)
```

(source: перенос ATB-67, [PR #405](https://github.com/sanchahous/ai-today-brief/pull/405))
