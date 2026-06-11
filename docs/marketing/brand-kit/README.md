# Brand kit — експорт PNG із SVG

Усі платформи приймають PNG/JPG, тож SVG треба один раз відрендерити.

## Найшвидший шлях (без інструментів)

1. Відкрий SVG у Chrome (перетягни файл у вкладку).
2. DevTools (F12) → Ctrl+Shift+P → «Capture node screenshot» на елементі `<svg>` — отримаєш PNG у нативному розмірі.

## Точний шлях (Inkscape, безкоштовно)

```powershell
inkscape avatar.svg -w 1024 -h 1024 -o avatar-1024.png
inkscape banner-x.svg -w 1500 -h 500 -o banner-x.png
inkscape banner-linkedin.svg -w 4200 -h 700 -o banner-linkedin.png
inkscape banner-youtube.svg -w 2560 -h 1440 -o banner-youtube.png
inkscape banner-facebook.svg -w 851 -h 315 -o banner-facebook.png
```

## Шрифт

Wordmark — **Fraunces** (бренд-шрифт сайту). Якщо Fraunces не встановлений
локально, рендер впаде на Georgia — теж прийнятно, але краще поставити:
[fonts.google.com/specimen/Fraunces](https://fonts.google.com/specimen/Fraunces)
(Install → перерендерити).

## Мапа використання

| Платформа | Аватар | Банер |
|---|---|---|
| X | avatar @ 400×400 | banner-x.png |
| Telegram | avatar @ 512×512 | — (банерів нема) |
| Bluesky / Mastodon | avatar @ 1000×1000 / 400×400 | banner-x.png (той самий спек 1500×500, ≤1 МБ) |
| Instagram / Threads | avatar @ 320×320+ | — |
| LinkedIn | avatar @ 400×400 | banner-linkedin.png |
| YouTube | avatar @ 800×800 | banner-youtube.png |
| Facebook | avatar @ 1024×1024 | banner-facebook.png (стиснути до <100 КБ JPG) |

Ліміти ваги: X/TG ≤2 МБ, Bluesky ≤1 МБ, LinkedIn ≤3 МБ, YouTube ≤6 МБ — PNG
з цих SVG важать копійки, проблем не буде.
