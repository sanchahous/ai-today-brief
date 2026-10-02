# Brand kit — After Hours mark (AH-3.8)

Social avatars and banners for AI Today Brief. Geometry matches `src/lib/brand-mark.ts`
(plate + nested A strokes + celadon signal dot). Palette: After Hours Night tokens
(`#171918` ink, `#f0e9dc` paper, `#d4b483` brass, `#b5d8cc` mint).

## Asset sizes

| File | Canvas | PNG export | Use |
|---|---|---|---|
| `avatar.svg` | 1024×1024 | `avatar-1024.png` | Profile photo (all platforms) |
| `banner-x.svg` | 1500×500 | `banner-x.png` | X, Bluesky, Mastodon header |
| `banner-linkedin.svg` | 4200×700 | `banner-linkedin.png` | LinkedIn Page cover |
| `banner-youtube.svg` | 2560×1440 | `banner-youtube.png` | YouTube channel art |
| `banner-facebook.svg` | 851×315 | `banner-facebook.png` | Facebook Page cover |

Mark occupies ~70% of the avatar safe circle — readable at 48 px (smallest feed crop).

## Export PNG

**Recommended (reproducible):**

```bash
npm run brand-kit:export
```

Writes all five PNG files next to the SVG sources.

**Inkscape (manual):**

```powershell
inkscape avatar.svg -w 1024 -h 1024 -o avatar-1024.png
inkscape banner-x.svg -w 1500 -h 500 -o banner-x.png
inkscape banner-linkedin.svg -w 4200 -h 700 -o banner-linkedin.png
inkscape banner-youtube.svg -w 2560 -h 1440 -o banner-youtube.png
inkscape banner-facebook.svg -w 851 -h 315 -o banner-facebook.png
```

**Browser (quick one-off):** open SVG in Chrome → DevTools → «Capture node screenshot»
on the `<svg>` element.

## Fonts

Wordmark — **Fraunces** (site display font). Body copy — **Inter**. Install Fraunces locally
before Inkscape export if you need pixel-perfect wordmark:
[fonts.google.com/specimen/Fraunces](https://fonts.google.com/specimen/Fraunces).
Georgia fallback is acceptable but slightly wider.

## Platform map

| Platform | Avatar size | Banner | Account (`src/lib/site.ts`) |
|---|---|---|---|
| X | `avatar-1024.png` → crop 400×400 | `banner-x.png` | `https://x.com/aitodaybrief` |
| Telegram | `avatar-1024.png` → crop 512×512 | — | `https://t.me/aitodaybrief` |
| LinkedIn | `avatar-1024.png` → crop 400×400 | `banner-linkedin.png` | Company `133973918` |
| YouTube | `avatar-1024.png` → crop 800×800 | `banner-youtube.png` | `@aitodaybrief` |
| Facebook | `avatar-1024.png` | `banner-facebook.png` (compress JPG <100 KB) | confirm with owner |
| Bluesky / Mastodon | `avatar-1024.png` | `banner-x.png` (≤1 MB) | confirm with owner |
| Instagram / Threads | `avatar-1024.png` → crop 320×320+ | — | confirm with owner |

File-weight limits: X/TG ≤2 MB, Bluesky ≤1 MB, LinkedIn ≤3 MB, YouTube ≤6 MB — PNGs from
this kit are well under all limits.

## Owner upload checklist (release day, D7)

Upload on the **same day** AH-3.1 / AH-3.7 / AH-3.8 merge — do not leave the legacy ATB
monogram live alongside the new site mark.

- [ ] **X** — Settings → Your account → Profile photo (`avatar-1024.png`) + Header (`banner-x.png`)
- [ ] **Telegram** — Channel settings → Edit → photo (`avatar-1024.png`)
- [ ] **LinkedIn** — Admin tools → Page → Logo + Cover image
- [ ] **YouTube** — Customisation → Branding → Picture + Banner image
- [ ] **Facebook** — Page settings → Profile picture + Cover photo (if Page exists)
- [ ] **Bluesky / Mastodon / Instagram / Threads** — only if project accounts exist (owner confirms)
- [ ] Tick this checklist in `wiki/log.md` after upload

Agent does **not** change platform settings — owner only.

## Launch card

`launch-card-independent.html` — 3-slide LinkedIn Document source (1080×1350). Render to PDF/PNG
via `scratchpad/render.mjs` or browser print. Uses the same After Hours mark and palette.
