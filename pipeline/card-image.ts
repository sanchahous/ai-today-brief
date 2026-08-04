/**
 * Per-item brand card images. For each freshly published brief item we generate
 * a unique editorial illustration that actually fits the story: a tiny text-model
 * call turns the headline + summary into a CONCRETE on-topic scene (no "glowing
 * brain" clichés), which becomes the dominant subject of a light brand-styled
 * prompt accented by the item's category colour. The image is stored in the
 * `card-images` Storage bucket and recorded on `brief_items.card_image_url`.
 *
 * Generation never blocks the brief and degrades gracefully down a quality ladder:
 *   1. Gemini "Nano Banana Pro" (gemini-3-pro-image) — best context-fit; opt-in
 *      via GEMINI_IMAGE_MODEL (needs Gemini billing; auto-skipped/-fallen-back
 *      otherwise).
 *   2. Cloudflare Workers AI FLUX.2 [klein] 9B — default (multipart API); override
 *      via CLOUDFLARE_IMAGE_MODEL (e.g. flux-2-dev).
 *   3. Cloudflare FLUX-1-schnell — JSON spillover if the primary CF model fails.
 *   4. Pollinations FLUX — last-resort public fallback.
 * When all fail the item keeps a null URL and the OG card renders its branded
 * duotone fallback. Runs post-publish, idempotent (skips items that already have
 * an image), so re-running the pipeline never regenerates or double-charges.
 */

import { createHash } from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import type { PipelineDb } from './db';
import { resolveGeminiModelQueue } from './gemini-models';
import { logEvent, serializeErrorDetails } from './log';

const BUCKET = 'card-images';
/**
 * Default Cloudflare Workers AI image model. FLUX.2 [klein] 9B — faster/cheaper
 * than Leonardo Lucid Origin, better quality than FLUX-1-schnell for editorial
 * covers. Override with CLOUDFLARE_IMAGE_MODEL (e.g. flux-2-dev) without a code
 * change.
 */
export const DEFAULT_CF_IMAGE_MODEL = '@cf/black-forest-labs/flux-2-klein-9b';
/** Cheap JSON spillover when the primary (multipart) CF model fails. */
export const SCHNELL_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const FALLBACK_ACCENT = '#5bc9f0';
/** 16:9 render size; crops cleanly to the 1200×630 OG card and the 92px feed thumb. */
export const IMG_W = 1280;
export const IMG_H = 720;
/** CF klein Unit Pricing defaults — overridable via env. */
const DEFAULT_USD_FIRST_MP = 0.015;
const DEFAULT_USD_NEXT_MP = 0.002;
// The local SVG is authored at this larger coordinate grid, then rasterized to
// the normal daily-card output dimensions above. Keeping the viewBox separate
// avoids clipping complex motifs while retaining the established 16:9 output.
const FALLBACK_VIEWBOX_W = 1600;
const FALLBACK_VIEWBOX_H = 900;
/** Safety cap: most a single run will spend per brief (idempotency bounds it anyway). */
const MAX_PER_RUN = 12;

export interface CardImageConfig {
  /** Cloudflare account id + Workers AI token (optional — CF tiers skip when unset). */
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  geminiApiKey: string;
  /** Optional current-generation text model pin for the scene step. */
  geminiModel?: string;
  /**
   * Gemini IMAGE model (e.g. 'gemini-3-pro-image'). Empty/undefined ⇒ the Gemini
   * image tier is off and generation starts at the Cloudflare tier.
   */
  geminiImageModel?: string;
  /** Cloudflare image model id (default {@link DEFAULT_CF_IMAGE_MODEL}). */
  cloudflareImageModel?: string;
  /** OpenRouter key — scene-step fallback when the Gemini free tier is rate-limited. */
  openRouterApiKey?: string;
  /** Optional hook after each successful remote/local image (cost ledger). */
  onImageGenerated?: (result: GeneratedImageResult) => void | Promise<void>;
}

export type ImageCostSource = 'reported' | 'estimated' | 'subscription';

/** Where the cover scene phrase came from (art-director LLM or keyword fallback). */
export type SceneSource = 'gemini' | 'openrouter' | 'fallback';

export interface SceneBriefResult {
  scene: string;
  source: SceneSource;
}

export interface GeneratedImageResult {
  bytes: Buffer;
  provider: 'gemini' | 'cloudflare' | 'pollinations' | 'local';
  model: string;
  estimatedCostUsd: number;
  costSource: ImageCostSource;
  width: number;
  height: number;
  /** Story-specific scene phrase sent to the image model (audit / admin). */
  scene?: string;
  positivePrompt?: string;
  negativePrompt?: string;
  sceneSource?: SceneSource;
}

export interface FillCardImagesResult {
  generated: number;
  skipped: number;
  failed: number;
}

export interface EditorialIllustrationInput {
  title: string;
  summary: string;
  accent?: string;
  seedKey: string;
  /**
   * Weekly Digest requires a reviewable visual for every selected story even
   * when remote providers are unavailable. Daily cards intentionally preserve
   * their existing null-image behavior instead.
   */
  fallbackToLocal?: boolean;
}

/** Megapixels billed for CF klein pricing (ceil, minimum 1). */
export function megapixelsForDimensions(width: number, height: number): number {
  return Math.max(1, Math.ceil((width * height) / 1_000_000));
}

/**
 * Estimated USD for a Cloudflare FLUX.2 klein-style output bill
 * ($firstMp + (mp-1)*nextMp). Override rates via env.
 */
export function estimateCloudflareImageCostUsd(
  width = IMG_W,
  height = IMG_H,
  env: Record<string, string | undefined> = process.env,
): number {
  const first = Number(env.CLOUDFLARE_IMAGE_USD_FIRST_MP ?? DEFAULT_USD_FIRST_MP);
  const next = Number(env.CLOUDFLARE_IMAGE_USD_NEXT_MP ?? DEFAULT_USD_NEXT_MP);
  const firstMp = Number.isFinite(first) && first >= 0 ? first : DEFAULT_USD_FIRST_MP;
  const nextMp = Number.isFinite(next) && next >= 0 ? next : DEFAULT_USD_NEXT_MP;
  const mp = megapixelsForDimensions(width, height);
  return firstMp + Math.max(0, mp - 1) * nextMp;
}

/** FLUX.2 family models require multipart/form-data even for text-only prompts. */
export function isFlux2MultipartModel(model: string): boolean {
  return /\/flux-2-/i.test(model);
}

/**
 * Generate a fresh, story-specific illustration without writing to `brief_items`.
 * Weekly Digest uses this for reviewable revision artifacts while the daily
 * pipeline continues to use {@link fillCardImages}.
 */
export async function generateEditorialIllustration(
  input: EditorialIllustrationInput,
  cfg: CardImageConfig,
): Promise<GeneratedImageResult | null> {
  const { scene, source: sceneSource } = await sceneBrief(input.title, input.summary, cfg);
  const positive = buildPrompt(input.accent?.trim() || 'cool cyan', scene);
  const negative = negativePrompt();
  const generated = await generateImage(positive, negative, cfg, seedFromString(input.seedKey));
  if (generated) {
    return {
      ...generated,
      scene,
      positivePrompt: positive,
      negativePrompt: negative,
      sceneSource,
    };
  }
  if (!input.fallbackToLocal) return null;
  // A Weekly Digest must stay reviewable even when every external image provider
  // is unavailable and the selected source has no approved image. This local
  // fallback uses a topic-specific technical motif rather than inventing a
  // photorealistic event or falling back to generic AI decoration.
  try {
    const bytes = await renderFallbackEditorialIllustration(input);
    return {
      bytes,
      provider: 'local',
      model: 'fallback-svg',
      estimatedCostUsd: 0,
      costSource: 'estimated',
      width: IMG_W,
      height: IMG_H,
      scene,
      positivePrompt: positive,
      negativePrompt: negative,
      sceneSource,
    };
  } catch {
    return null;
  }
}

/**
 * Generate + store card images for every item of a brief that still lacks one.
 * Best-effort and idempotent — already-imaged and rejected items are skipped.
 */
export async function fillCardImages(
  db: PipelineDb,
  briefId: string,
  cfg: CardImageConfig,
  opts: { force?: boolean } = {},
): Promise<FillCardImagesResult> {
  const { data: items, error } = await db
    .from('brief_items')
    .select(
      'id, slug, title_en, title_uk, summary_en, summary_uk, category_slug, card_image_url, review_status',
    )
    .eq('brief_id', briefId);
  if (error) throw new Error(`[card-image] load items failed: ${error.message}`);

  const all = items ?? [];
  const pending = all.filter(
    (it) => it.slug && it.review_status !== 'rejected' && (opts.force || !it.card_image_url),
  );
  if (pending.length === 0) {
    return { generated: 0, skipped: all.length, failed: 0 };
  }

  const colorBySlug = await loadCategoryColors(db);

  let generated = 0;
  let failed = 0;
  for (const it of pending.slice(0, MAX_PER_RUN)) {
    try {
      const title = (it.title_en || it.title_uk || '').trim();
      const summary = (it.summary_en || it.summary_uk || '').trim();
      const accent = hueName(colorBySlug.get(it.category_slug ?? '') ?? FALLBACK_ACCENT);
      const result = await generateEditorialIllustration(
        { title, summary, accent, seedKey: it.slug! },
        cfg,
      );
      if (!result) {
        failed++;
        logEvent('warn', 'publish', 'Card image generation returned nothing', { slug: it.slug });
        continue;
      }
      const url = await uploadCardImage(db, it.slug!, result.bytes);
      if (!url) {
        failed++;
        continue;
      }
      const { error: updErr } = await db
        .from('brief_items')
        .update({ card_image_url: url })
        .eq('id', it.id);
      if (updErr) {
        failed++;
        logEvent('warn', 'publish', 'Card image url update failed', {
          slug: it.slug,
          error: updErr.message,
        });
        continue;
      }
      await cfg.onImageGenerated?.(result);
      generated++;
    } catch (e) {
      failed++;
      logEvent('warn', 'publish', 'Card image step failed (non-fatal)', {
        slug: it.slug,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { generated, skipped: all.length - pending.length, failed };
}

async function loadCategoryColors(db: PipelineDb): Promise<Map<string, string | null>> {
  const { data } = await db.from('categories').select('slug, color');
  return new Map((data ?? []).map((c) => [c.slug, c.color]));
}

/**
 * Light brand styling wrapped around a story-specific SCENE. The scene is the
 * dominant clause (so each card looks distinct); the constant styling is a thin
 * editorial thread + the category accent — deliberately NOT a heavy "near-black
 * cinematic" preamble, which is what previously homogenised every card.
 *
 * Never ask for "space for a headline" — FLUX paints gibberish mastheads when
 * prompted that way. Typography is added later in layout, never baked into pixels.
 */
export function buildPrompt(accent: string, scene: string): string {
  return (
    `Premium editorial illustration, pure visual storytelling only — no typography in the image. ` +
    `One strong focal subject, clear narrative metaphor, tasteful depth of field and confident ` +
    `directional lighting, ${accent} as the signature accent woven through the palette, a refined ` +
    `modern atmosphere with real texture and craft — not flat, not a generic stock render. ` +
    `Keep the top and bottom calm and empty for later layout compositing; leave those bands blank ` +
    `(do not paint titles, mastheads, captions, subtitles, or any lettering there). ` +
    `Absolutely no text, no words, no letters, no numbers, no glyphs, no logos, no watermark, ` +
    `no title bar, no newspaper headline, no UI chrome, no readable screens, no frame, no border. ` +
    `Scene: ${scene} Wide 16:9 horizontal composition, edge-to-edge full-bleed.`
  );
}

/**
 * Negative keywords for models that accept them (e.g. flux-1-schnell spillover).
 * FLUX.2 klein on Workers AI has no negative_prompt — rely on {@link buildPrompt}.
 */
export function negativePrompt(): string {
  return (
    `text, words, letters, typography, numbers, glyphs, caption, subtitle, masthead, title bar, ` +
    `headline, newspaper headline, magazine cover text, watermark, signature, logo, brand mark, ` +
    `UI, interface, buttons, readable screen text, frame, border, collage, split panels, ` +
    `glowing brain, human brain, brain, neural-network mesh, circuit board, generic glowing orb, ` +
    `floating sphere, abstract blob, anonymous server aisle, lone laptop on desk, ` +
    `generic data-center corridor, stock server room, interchangeable tech stock, ` +
    `low quality, blurry, jpeg artifacts, distorted, deformed, ` +
    `extra fingers, extra limbs, cluttered, busy, stock-photo look`
  );
}

const DEFAULT_SCENE =
  'a sleek developer workstation in a dark studio, sharp focus on a mechanical keyboard and ' +
  'softly floating translucent code panels, warm key light';

type FallbackIllustrationMotif =
  | 'memory'
  | 'security'
  | 'funding'
  | 'agents'
  | 'model'
  | 'local'
  | 'efficiency'
  | 'vision'
  | 'workstation';

/**
 * Choose a concrete, story-shaped visual subject for the offline renderer.
 * It deliberately operates on editorial text only; no external claim or brand
 * asset is synthesized when image providers are unavailable.
 */
export function fallbackIllustrationMotif(value: string): FallbackIllustrationMotif {
  const text = value.toLowerCase();
  const has = (...terms: string[]) => terms.some((term) => text.includes(term));
  if (has('memory', 'rag', 'retriev', 'embedding', 'sqlite', 'context')) return 'memory';
  if (has('security', 'vulnerab', 'exploit', 'breach', 'cve', 'malware', 'attack'))
    return 'security';
  if (has('fund', 'raise', 'valuation', 'investment', 'revenue', 'ipo', 'billion'))
    return 'funding';
  if (has('agent', 'mcp', 'orchestr', 'workflow', 'autonom')) return 'agents';
  if (has('model', 'launch', 'release', 'gpt', 'claude', 'gemini', 'llama', 'benchmark'))
    return 'model';
  if (has('local', 'on-device', 'offline', 'privacy', 'gemma', 'llm')) return 'local';
  if (has('token', 'cost', 'cheap', 'efficien', 'speed', 'latency', 'optimiz')) return 'efficiency';
  if (has('image', 'video', 'medical', 'scan', 'mri', 'vision', 'creative', 'art')) return 'vision';
  return 'workstation';
}

function fallbackPalette(seed: number) {
  const palettes = [
    { accent: '#4ee3d3', secondary: '#4f8cff', glow: '#6eebdb' },
    { accent: '#a78bfa', secondary: '#4dd4ff', glow: '#c4b5fd' },
    { accent: '#f0c040', secondary: '#ef8354', glow: '#f8dc7b' },
    { accent: '#54d88b', secondary: '#43b9d2', glow: '#8eeeb5' },
  ];
  return palettes[seed % palettes.length];
}

function fallbackMotifSvg(
  motif: FallbackIllustrationMotif,
  colors: ReturnType<typeof fallbackPalette>,
  seed: number,
) {
  const offset = 18 + (seed % 5) * 9;
  const card = (x: number, y: number, width: number, height: number, opacity = 0.92) =>
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="#151f2a" fill-opacity="${opacity}" stroke="${colors.accent}" stroke-opacity=".58" stroke-width="3"/>`;
  const node = (x: number, y: number, r = 21) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors.accent}" fill-opacity=".9"/><circle cx="${x}" cy="${y}" r="${Math.max(5, r - 10)}" fill="#f7fafc" fill-opacity=".88"/>`;

  if (motif === 'memory') {
    return `
      <g filter="url(#soft-shadow)">
        <ellipse cx="476" cy="588" rx="164" ry="38" fill="#0a1018" stroke="${colors.secondary}" stroke-width="5"/>
        <rect x="312" y="420" width="328" height="168" fill="#121d28" stroke="${colors.secondary}" stroke-width="5"/>
        <ellipse cx="476" cy="420" rx="164" ry="38" fill="#1b2c3a" stroke="${colors.secondary}" stroke-width="5"/>
        <path d="M332 467h288M332 516h288" stroke="${colors.secondary}" stroke-opacity=".6" stroke-width="4"/>
        ${card(850, 300 + offset, 286, 124)}
        ${card(900, 462 + offset, 286, 124, 0.78)}
        ${card(850, 624 + offset, 286, 124, 0.62)}
        <path d="M642 504 C742 504 734 362 848 362 M642 504 C742 504 754 524 898 524 M642 504 C748 504 736 686 848 686" fill="none" stroke="${colors.accent}" stroke-width="7" stroke-linecap="round"/>
        ${node(710, 504, 30)}
      </g>`;
  }
  if (motif === 'security') {
    return `
      <g filter="url(#soft-shadow)">
        <path d="M800 214 L1052 310 V506 C1052 675 948 758 800 812 C652 758 548 675 548 506 V310 Z" fill="#14222d" stroke="${colors.accent}" stroke-width="8"/>
        <rect x="698" y="465" width="204" height="174" rx="30" fill="#0d151e" stroke="${colors.secondary}" stroke-width="7"/>
        <path d="M744 465v-48c0-80 112-80 112 0v48" fill="none" stroke="${colors.secondary}" stroke-width="18" stroke-linecap="round"/>
        <circle cx="800" cy="548" r="25" fill="${colors.accent}"/><path d="M800 570v42" stroke="${colors.accent}" stroke-width="17" stroke-linecap="round"/>
        <path d="M350 340 L500 420 M1100 340 L950 420 M364 664 L540 594 M1236 664 L1060 594" stroke="${colors.accent}" stroke-opacity=".55" stroke-width="5"/>
        ${node(332, 330, 15)}${node(1268, 330, 15)}${node(346, 674, 15)}${node(1254, 674, 15)}
      </g>`;
  }
  if (motif === 'funding') {
    return `
      <g filter="url(#soft-shadow)">
        <ellipse cx="480" cy="638" rx="142" ry="34" fill="#14222d" stroke="${colors.accent}" stroke-width="5"/>
        <path d="M338 638v-148c0-26 284-26 284 0v148" fill="#182b32" stroke="${colors.accent}" stroke-width="5"/>
        <ellipse cx="480" cy="490" rx="142" ry="34" fill="#233b41" stroke="${colors.accent}" stroke-width="5"/>
        <ellipse cx="480" cy="564" rx="142" ry="34" fill="none" stroke="${colors.secondary}" stroke-opacity=".7" stroke-width="5"/>
        <path d="M708 658 C810 564 922 510 1210 300" fill="none" stroke="${colors.secondary}" stroke-width="14" stroke-linecap="round"/>
        <path d="M1120 300h90v90" fill="none" stroke="${colors.secondary}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
        ${node(708, 658, 20)}${node(944, 486, 20)}${node(1210, 300, 20)}
      </g>`;
  }
  if (motif === 'agents') {
    return `
      <g filter="url(#soft-shadow)">
        ${card(256, 330, 270, 238)}${card(665, 200 + offset, 270, 238)}${card(1030, 510, 270, 238)}
        <path d="M526 448 C594 438 588 364 665 350 M935 350 C1010 356 980 606 1030 628 M526 500 C738 718 864 730 1030 652" fill="none" stroke="${colors.accent}" stroke-width="8" stroke-linecap="round"/>
        ${node(390, 449, 39)}${node(800, 319 + offset, 39)}${node(1165, 629, 39)}
        <path d="M366 449h48M776 ${319 + offset}h48M1141 629h48" stroke="#f7fafc" stroke-width="7" stroke-linecap="round"/>
      </g>`;
  }
  if (motif === 'model') {
    return `
      <g filter="url(#soft-shadow)">
        <path d="M380 690 L800 448 L1220 690 L800 824 Z" fill="#14222d" stroke="${colors.secondary}" stroke-width="7"/>
        <path d="M380 690 L380 372 L800 140 L1220 372 L1220 690" fill="#182733" stroke="${colors.accent}" stroke-width="7"/>
        <path d="M380 372 L800 612 L1220 372 M800 140v472" fill="none" stroke="${colors.accent}" stroke-opacity=".6" stroke-width="6"/>
        <rect x="670" y="372" width="260" height="176" rx="30" fill="#0c141d" stroke="${colors.accent}" stroke-width="8"/>
        <path d="M720 430h160M720 488h110" stroke="${colors.secondary}" stroke-width="14" stroke-linecap="round"/>
      </g>`;
  }
  if (motif === 'local') {
    return `
      <g filter="url(#soft-shadow)">
        <path d="M396 612h808l-78 92H474Z" fill="#111c26" stroke="${colors.secondary}" stroke-width="7"/>
        <rect x="490" y="226" width="620" height="394" rx="28" fill="#15242f" stroke="${colors.accent}" stroke-width="8"/>
        <rect x="534" y="270" width="532" height="306" rx="14" fill="#0b121a"/>
        <path d="M600 366h190M600 438h318M600 510h230" stroke="${colors.accent}" stroke-width="14" stroke-linecap="round"/>
        <circle cx="984" cy="488" r="42" fill="${colors.secondary}" fill-opacity=".72"/>
      </g>`;
  }
  if (motif === 'efficiency') {
    return `
      <g filter="url(#soft-shadow)">
        <path d="M412 678 A388 388 0 0 1 1188 678" fill="none" stroke="#1e313d" stroke-width="78" stroke-linecap="round"/>
        <path d="M412 678 A388 388 0 0 1 1044 366" fill="none" stroke="${colors.accent}" stroke-width="32" stroke-linecap="round"/>
        <path d="M800 678 L1034 394" stroke="#f7fafc" stroke-width="14" stroke-linecap="round"/>
        <circle cx="800" cy="678" r="41" fill="${colors.secondary}" stroke="#f7fafc" stroke-width="7"/>
        <path d="M430 740h740" stroke="${colors.secondary}" stroke-opacity=".6" stroke-width="5"/>
      </g>`;
  }
  if (motif === 'vision') {
    return `
      <g filter="url(#soft-shadow)">
        <rect x="300" y="222" width="1000" height="500" rx="34" fill="#13212c" stroke="${colors.accent}" stroke-width="8"/>
        <rect x="348" y="270" width="904" height="404" rx="20" fill="#091119"/>
        <ellipse cx="800" cy="472" rx="250" ry="150" fill="${colors.secondary}" fill-opacity=".26" stroke="${colors.secondary}" stroke-width="7"/>
        <circle cx="800" cy="472" r="88" fill="${colors.accent}" fill-opacity=".7"/>
        <circle cx="800" cy="472" r="38" fill="#f7fafc"/>
        <path d="M462 610 C590 548 612 434 704 350 M1138 610 C1010 548 988 434 896 350" fill="none" stroke="${colors.accent}" stroke-opacity=".7" stroke-width="7"/>
      </g>`;
  }
  return `
    <g filter="url(#soft-shadow)">
      <path d="M274 680h1052l-96 92H370Z" fill="#111c26" stroke="${colors.secondary}" stroke-width="7"/>
      <rect x="436" y="208" width="728" height="474" rx="34" fill="#15232e" stroke="${colors.accent}" stroke-width="8"/>
      <rect x="486" y="258" width="628" height="360" rx="20" fill="#0a1119"/>
      <path d="M560 354h208M560 426h370M560 498h268" stroke="${colors.accent}" stroke-width="15" stroke-linecap="round"/>
      <circle cx="1002" cy="500" r="54" fill="${colors.secondary}" fill-opacity=".72"/>
      <path d="M1002 452v96M954 500h96" stroke="#f7fafc" stroke-width="9" stroke-linecap="round"/>
    </g>`;
}

/**
 * A deterministic, non-generative illustration used only after every remote
 * provider and reviewed source image is unavailable. It remains specific to the
 * story's technical subject while making the binary generation path testable.
 */
export async function renderFallbackEditorialIllustration(
  input: EditorialIllustrationInput,
): Promise<Buffer> {
  const seed = seedFromString(input.seedKey);
  const motif = fallbackIllustrationMotif(`${input.title} ${input.summary}`);
  const colors = fallbackPalette(seed);
  const svg = Buffer.from(`
    <svg width="${IMG_W}" height="${IMG_H}" viewBox="0 0 ${FALLBACK_VIEWBOX_W} ${FALLBACK_VIEWBOX_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#071019"/>
          <stop offset=".54" stop-color="#101e2a"/>
          <stop offset="1" stop-color="#11121c"/>
        </linearGradient>
        <radialGradient id="halo" cx="50%" cy="44%" r="58%">
          <stop offset="0" stop-color="${colors.glow}" stop-opacity=".26"/>
          <stop offset="1" stop-color="${colors.glow}" stop-opacity="0"/>
        </radialGradient>
        <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="24" stdDeviation="22" flood-color="#02070b" flood-opacity=".72"/>
        </filter>
      </defs>
      <rect width="${FALLBACK_VIEWBOX_W}" height="${FALLBACK_VIEWBOX_H}" fill="url(#bg)"/>
      <rect width="${FALLBACK_VIEWBOX_W}" height="${FALLBACK_VIEWBOX_H}" fill="url(#halo)"/>
      <path d="M0 162H${FALLBACK_VIEWBOX_W}M0 324H${FALLBACK_VIEWBOX_W}M0 486H${FALLBACK_VIEWBOX_W}M0 648H${FALLBACK_VIEWBOX_W}" stroke="#d5f5f1" stroke-opacity=".055" stroke-width="2"/>
      <path d="M200 0V${FALLBACK_VIEWBOX_H}M400 0V${FALLBACK_VIEWBOX_H}M600 0V${FALLBACK_VIEWBOX_H}M800 0V${FALLBACK_VIEWBOX_H}M1000 0V${FALLBACK_VIEWBOX_H}M1200 0V${FALLBACK_VIEWBOX_H}M1400 0V${FALLBACK_VIEWBOX_H}" stroke="#d5f5f1" stroke-opacity=".045" stroke-width="2"/>
      ${fallbackMotifSvg(motif, colors, seed)}
      <rect x="112" y="112" width="110" height="10" rx="5" fill="${colors.accent}"/>
      <rect x="112" y="140" width="202" height="5" rx="2.5" fill="#e8f5f3" fill-opacity=".34"/>
    </svg>
  `);
  const output = await sharp(svg).png().toBuffer();
  const metadata = await sharp(output).metadata();
  if (metadata.width !== IMG_W || metadata.height !== IMG_H) {
    throw new Error('Fallback editorial illustration has invalid dimensions.');
  }
  return output;
}

/**
 * Turn a headline + summary into ONE concrete, on-topic cover scene — a clear
 * focal subject a reader instantly ties to THIS story, with the over-used "AI"
 * clichés explicitly banned so cards stop looking interchangeable. Falls back to
 * a keyword-chosen concrete scene (never a brain) if the model call fails.
 */
export async function sceneBrief(
  title: string,
  summary: string,
  cfg: CardImageConfig,
): Promise<SceneBriefResult> {
  const ctx = [title, summary].filter(Boolean).join('. ').trim();
  if (!ctx) return { scene: DEFAULT_SCENE, source: 'fallback' };
  const instruction =
    `You are the art director for a developer-focused technology magazine. Read this news item and ` +
    `describe ONE concrete cover illustration a reader instantly connects to THIS specific story. ` +
    `Name the distinctive news claim in visual form; avoid interchangeable tech stock. ` +
    `Invent a UNIQUE narrative metaphor for THIS claim — what sets it apart from neighbouring ` +
    `AI-security or model-launch stories — as a tangible focal subject + setting + action. ` +
    `Good claim-specific examples: an agent figure breaking out of a cracked glass sandbox cage toward ` +
    `glowing external network routes (egress / misconfig escape); a shattered cryptographic seal or ` +
    `cracked padlock over dark circuitry (cryptanalysis); interlocking precision machinery for tooling; ` +
    `cooperating robotic arms for multi-agent orchestration; an MRI lightbox for medical imaging; ` +
    `stacked translucent coins for funding; a product unveiled on a reveal stage for a launch. ` +
    `STRICTLY AVOID default stock unless the story is literally about those objects as the main claim: ` +
    `anonymous server aisle, lone laptop on a desk, generic data-center corridor, anonymous rack row. ` +
    `Also ban: a glowing brain, glowing orb or core, neural-network mesh, generic circuit board, vague ` +
    `abstract "AI" blob. No text, letters, numbers, logos, brand marks or recognisable real faces. ` +
    `If a document or screen appears, keep it blank or abstract — never readable writing. ` +
    `Answer with ONE vivid phrase, 18-32 words, concrete nouns, a single focal subject, not a full ` +
    `sentence.\n\nHeadline: "${title}"\nSummary: "${summary}"`;
  const clean = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 320);
  // Primary: Gemini. Fallback: OpenRouter (separate billing → survives Gemini
  // free-tier rate limits, e.g. during a backfill). Last resort: a keyword scene.
  try {
    const models = await resolveGeminiModelQueue(cfg.geminiApiKey, {
      ...process.env,
      GEMINI_MODEL: cfg.geminiModel ?? process.env.GEMINI_MODEL,
      GEMINI_MAX_MODEL_ATTEMPTS: '2',
    });
    const client = new GoogleGenerativeAI(cfg.geminiApiKey);
    for (const model of models) {
      try {
        const response = await client.getGenerativeModel({ model }).generateContent(instruction);
        const text = clean(response.response.text());
        if (text.length >= 6) return { scene: text, source: 'gemini' };
      } catch {
        // Advance only within the current generation resolved from the catalog.
      }
    }
  } catch {
    /* fall through to OpenRouter */
  }

  if (cfg.openRouterApiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.openRouterApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          // Moving alias: never falls back to a retired numbered release.
          model: '~openai/gpt-mini-latest',
          messages: [{ role: 'user', content: instruction }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = clean(data.choices?.[0]?.message?.content ?? '');
        if (text.length >= 6) return { scene: text, source: 'openrouter' };
      }
    } catch {
      /* fall through to keyword scene */
    }
  }

  return { scene: fallbackScene(ctx), source: 'fallback' };
}

/** Keyword → concrete scene, so even without the model cards vary by topic (never a brain). */
export function fallbackScene(text: string): string {
  const t = text.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => t.includes(w));
  // Isolation / network escape — before generic agent or model-launch branches.
  if (
    has(
      'misconfig',
      'egress',
      'sandbox',
      'post-mortem',
      'postmortem',
      'breakout',
      'exfiltrat',
    ) ||
    (has('network') && has('isolat', 'external', 'misconfig', 'egress'))
  ) {
    return (
      'an autonomous agent figure breaking through a cracked glass sandbox cage toward glowing ' +
      'external network routes, shards of the isolation barrier mid-air'
    );
  }
  // Cryptanalysis / cipher strength — before "claude" / model-launch stock.
  if (
    has(
      'cryptanalys',
      'cryptograph',
      'cipher',
      'encryption',
      'decrypt',
      'key strength',
      'mythos',
    )
  ) {
    return (
      'a cracked cryptographic seal and shattered padlock over dark circuitry, shards catching a ' +
      'hard rim light'
    );
  }
  if (has('security', 'vulnerab', 'exploit', 'breach', 'cve', 'malware', 'attack'))
    return 'a cracked metallic padlock over a dark server panel, shards catching a hard rim light';
  if (has('fund', 'raise', 'valuation', 'investment', 'revenue', 'ipo', 'billion'))
    return 'tall stacked translucent coin towers with streams of light flowing between them on a dark desk';
  if (has('agent', 'mcp', 'orchestr', 'workflow', 'autonom'))
    return 'several precise robotic arms cooperating around a glowing modular workbench in a dark lab';
  if (has('model', 'launch', 'release', 'gpt', 'claude', 'gemini', 'llama', 'benchmark'))
    return 'a sleek matte device unveiled under a single spotlight on a dark reveal stage';
  if (has('local', 'on-device', 'offline', 'privacy', 'gemma', 'llm'))
    return 'a laptop on a wooden desk glowing in a dim room, soft particles rising from the screen';
  if (has('token', 'cost', 'cheap', 'efficien', 'speed', 'latency', 'optimiz'))
    return 'a precision gauge and flowing light ribbons through a sleek metal channel on a dark surface';
  if (has('image', 'video', 'medical', 'scan', 'mri', 'vision', 'creative', 'art'))
    return 'a backlit radiology lightbox displaying abstract luminous scans in a dark studio';
  return DEFAULT_SCENE;
}

/** Quality ladder: Gemini image → Cloudflare FLUX.2 (default) → schnell → Pollinations. */
async function generateImage(
  positive: string,
  negative: string,
  cfg: CardImageConfig,
  seed: number,
): Promise<GeneratedImageResult | null> {
  if (cfg.geminiImageModel) {
    const g = await generateGemini(positive, cfg);
    if (g) return g;
  }
  const hasCf = !!(cfg.cloudflareAccountId && cfg.cloudflareApiToken);
  if (hasCf) {
    const cfModel = cfg.cloudflareImageModel?.trim() || DEFAULT_CF_IMAGE_MODEL;
    const primary = await generateCloudflare(cfModel, positive, negative, cfg, seed);
    if (primary) return primary;
    if (cfModel !== SCHNELL_MODEL) {
      const spill = await generateCloudflare(SCHNELL_MODEL, positive, negative, cfg, seed);
      if (spill) return spill;
    }
  }
  return generatePollinations(positive, seed);
}

/** Top tier: Gemini "Nano Banana" image models via the generateContent REST API. */
async function generateGemini(
  prompt: string,
  cfg: CardImageConfig,
): Promise<GeneratedImageResult | null> {
  const model = cfg.geminiImageModel!.trim();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': cfg.geminiApiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio: '16:9' },
          },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );
    if (!res.ok) {
      logEvent('warn', 'publish', 'Gemini image gen failed', { status: res.status, model });
      return null;
    }
    const data = (await res.json()) as {
      candidates?: {
        content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] };
      }[];
    };
    for (const part of data.candidates?.[0]?.content?.parts ?? []) {
      const b64 = part.inlineData?.data ?? part.inline_data?.data;
      if (b64) {
        return {
          bytes: Buffer.from(b64, 'base64'),
          provider: 'gemini',
          model,
          // Gemini image billing is opt-in and not priced here; mark estimated $0
          // so the ledger still records the provider/model for audit.
          estimatedCostUsd: 0,
          costSource: 'estimated',
          width: IMG_W,
          height: IMG_H,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Cloudflare Workers AI. FLUX.2 models use multipart/form-data; flux-1-schnell
 * and legacy Leonardo JSON models use application/json. Tolerates both response
 * shapes: JSON `{result:{image:base64}}` and raw binary.
 */
async function generateCloudflare(
  model: string,
  positive: string,
  negative: string,
  cfg: CardImageConfig,
  seed: number,
): Promise<GeneratedImageResult | null> {
  const bytes = isFlux2MultipartModel(model)
    ? await runCloudflareMultipart(model, positive, cfg)
    : await runCloudflareJson(model, positive, negative, cfg, seed);
  if (!bytes) return null;
  const isSchnell = model === SCHNELL_MODEL || model.endsWith('/flux-1-schnell');
  return {
    bytes,
    provider: 'cloudflare',
    model,
    estimatedCostUsd: isSchnell
      ? 0.0005 // rough free-tier neuron estimate; refine via CLOUDFLARE_IMAGE_* if needed
      : estimateCloudflareImageCostUsd(IMG_W, IMG_H),
    costSource: 'estimated',
    width: IMG_W,
    height: IMG_H,
  };
}

async function runCloudflareMultipart(
  model: string,
  positive: string,
  cfg: CardImageConfig,
): Promise<Buffer | null> {
  try {
    const form = new FormData();
    form.append('prompt', positive);
    form.append('width', String(IMG_W));
    form.append('height', String(IMG_H));
    // klein steps are fixed at 4 server-side — do not send steps.
    if (/flux-2-dev/i.test(model)) {
      form.append('steps', '25');
    }
    // Pass FormData directly. The Workers-binding docs serialize via
    // `new Response(form).body`, but Node/undici fetch rejects a raw
    // ReadableStream body without `duplex: 'half'` and we were catching that
    // as a silent null — every prod call spilled over to flux-1-schnell.
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfg.cloudflareAccountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.cloudflareApiToken}`,
        },
        body: form,
        signal: AbortSignal.timeout(90_000),
      },
    );
    return await readCloudflareImageResponse(res, model);
  } catch (error) {
    logEvent('warn', 'publish', 'Cloudflare multipart image gen threw', {
      model,
      ...serializeErrorDetails(error),
    });
    return null;
  }
}

async function runCloudflareJson(
  model: string,
  positive: string,
  negative: string,
  cfg: CardImageConfig,
  seed: number,
): Promise<Buffer | null> {
  const isSchnell = model === SCHNELL_MODEL || model.endsWith('/flux-1-schnell');
  const body = isSchnell
    ? { prompt: positive, steps: 8, seed }
    : {
        prompt: positive,
        negative_prompt: negative,
        width: IMG_W,
        height: IMG_H,
        steps: 20,
        guidance: 4.5,
        seed,
      };
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfg.cloudflareAccountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.cloudflareApiToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      },
    );
    return await readCloudflareImageResponse(res, model);
  } catch (error) {
    logEvent('warn', 'publish', 'Cloudflare JSON image gen threw', {
      model,
      ...serializeErrorDetails(error),
    });
    return null;
  }
}

async function readCloudflareImageResponse(res: Response, model: string): Promise<Buffer | null> {
  if (!res.ok) {
    logEvent('warn', 'publish', 'Cloudflare image gen failed', { status: res.status, model });
    return null;
  }
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const data = (await res.json()) as { result?: { image?: string } };
    const b64 = data.result?.image;
    return b64 ? Buffer.from(b64, 'base64') : null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length > 1024 ? buf : null;
}

/** Fallback: Pollinations FLUX (no key, public — native 16:9). */
async function generatePollinations(
  prompt: string,
  seed: number,
): Promise<GeneratedImageResult | null> {
  try {
    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?width=1216&height=640&model=flux&nologo=true&seed=${seed}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length <= 1024) return null;
    return {
      bytes: buf,
      provider: 'pollinations',
      model: 'flux',
      estimatedCostUsd: 0,
      costSource: 'estimated',
      width: 1216,
      height: 640,
    };
  } catch {
    return null;
  }
}

async function uploadCardImage(db: PipelineDb, slug: string, png: Buffer): Promise<string | null> {
  const path = `${slug}.png`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, png, { contentType: 'image/png', upsert: true });
  if (error) {
    logEvent('warn', 'publish', 'Card image upload failed', { slug, error: error.message });
    return null;
  }
  // Content-hash version query so regenerating the same path busts the
  // image/CDN cache (the public URL is stable; the ?v changes with the bytes).
  const version = createHash('sha1').update(png).digest('hex').slice(0, 10);
  return `${db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}?v=${version}`;
}

/** Map any hex accent colour to a prompt-friendly colour word via its hue. */
export function hueName(hex: string | null): string {
  const h = hueOf(hex ?? '');
  if (h < 0) return 'cool cyan'; // achromatic / missing / invalid → brand default
  if (h < 15) return 'crimson red';
  if (h < 45) return 'amber orange';
  if (h < 70) return 'golden yellow';
  if (h < 160) return 'emerald green';
  if (h < 200) return 'teal';
  if (h < 250) return 'cyan';
  if (h < 290) return 'electric blue';
  if (h < 320) return 'violet purple';
  if (h < 345) return 'magenta pink';
  return 'crimson red';
}

/** Hue in degrees [0,360), or -1 when the colour is (near) achromatic. */
function hueOf(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return -1;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.06) return -1;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

export function seedFromString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000;
}
