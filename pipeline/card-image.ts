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
import sharp from 'sharp';
import type { PipelineDb } from './db';
import { logEvent, serializeErrorDetails } from './log';
import {
  generateWithRegistry,
  loadProviderRegistry,
  type ProviderRegistry,
  type ProviderRole,
} from './providers/registry';

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
  /**
   * Supabase client -- enables DB-driven role-chain overrides for the scene-brief
   * step (owner-added providers via /admin/providers, see
   * pipeline/providers/registry.ts). Optional; the ladder still works from the
   * env keys above alone without it.
   */
  db?: PipelineDb;
  /**
   * Pre-built registry for the scene-brief step. {@link fillCardImages} resolves
   * one once per batch and reuses it across items instead of re-resolving (and
   * re-fetching the live OpenRouter catalog) on every item.
   */
  registry?: ProviderRegistry;
  /** Optional hook after each successful remote/local image (cost ledger). */
  onImageGenerated?: (result: GeneratedImageResult) => void | Promise<void>;
}

export type ImageCostSource = 'reported' | 'estimated' | 'subscription';

/**
 * Where the cover scene phrase came from. 'fallback' = keyword-matched scene
 * (no model call, or every provider in the chain failed/was unconfigured);
 * 'owner' = typed directly in the Visuals tab (weekly only). Any other value
 * is the id of the provider that generated it (e.g. 'gemini', 'openrouter',
 * or an id an owner added via /admin/providers, e.g. 'nim') -- see
 * pipeline/providers/registry.ts.
 */
export type SceneSource = string;

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
  // Resolve the scene-brief provider chain once for the whole batch -- per-item
  // resolution would re-fetch the live OpenRouter catalog (and re-query the DB
  // role chain) up to MAX_PER_RUN times for no benefit.
  const sceneRegistry = await resolveSceneRegistry({ ...cfg, db });
  const itemCfg: CardImageConfig = { ...cfg, db, registry: sceneRegistry };

  let generated = 0;
  let failed = 0;
  for (const it of pending.slice(0, MAX_PER_RUN)) {
    try {
      const title = (it.title_en || it.title_uk || '').trim();
      const summary = (it.summary_en || it.summary_uk || '').trim();
      const accent = hueName(colorBySlug.get(it.category_slug ?? '') ?? FALLBACK_ACCENT);
      const result = await generateEditorialIllustration(
        { title, summary, accent, seedKey: it.slug! },
        itemCfg,
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
 * Art-director models (esp. OpenRouter chat) sometimes ignore "ONE vivid phrase"
 * and wrap the scene in JSON (`{"frame":"..."}`) or a markdown fence. That
 * literal wrapper then lands in the image prompt and FLUX paints the braces /
 * keys into the frame, or follows a "second panel" instruction that the house
 * style explicitly bans. Unwrap before the scene reaches buildWeeklyPrompt.
 */
export function cleanSceneText(text: string): string {
  let cleaned = text.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (cleaned.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        for (const key of ['frame', 'scene', 'description', 'prompt', 'text', 'caption']) {
          const value = record[key];
          if (typeof value === 'string' && value.trim().length >= 6) {
            cleaned = value.trim();
            break;
          }
        }
      }
    } catch {
      // keep the original cleaned string
    }
  }
  // Drop leftover quote wrappers the model sometimes adds around the phrase.
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '').trim();
  return cleaned.slice(0, 320);
}

/**
 * Resolves the provider chain for a scene-brief call: reuses a pre-built
 * registry if the caller supplied one (see {@link fillCardImages}), else
 * builds one from this call's env keys + optional `db` (DB-driven role-chain
 * overrides an owner configured via /admin/providers -- see
 * pipeline/providers/registry.ts).
 */
async function resolveSceneRegistry(cfg: CardImageConfig): Promise<ProviderRegistry> {
  if (cfg.registry) return cfg.registry;
  return loadProviderRegistry(
    { GEMINI_API_KEY: cfg.geminiApiKey, OPEN_ROUTER_API_KEY: cfg.openRouterApiKey },
    {},
    cfg.db,
  );
}

/**
 * Shared art-director ladder: resolves this call's provider chain and sends
 * one instruction string to it, returning the cleaned reply or null if every
 * provider in the chain failed/was unconfigured. {@link sceneBrief} and
 * {@link weeklyReportageSceneBrief} each build their own instruction text
 * (daily vs. weekly house style) and fall back to their own keyword scene
 * when this returns null.
 */
async function runArtDirectorLadder(
  instruction: string,
  role: ProviderRole,
  cfg: CardImageConfig,
): Promise<{ text: string; source: string } | null> {
  try {
    const registry = await resolveSceneRegistry(cfg);
    const result = await generateWithRegistry(role, instruction, registry);
    const text = cleanSceneText(result.text);
    if (text.length >= 6) return { text, source: result.provider };
  } catch (error) {
    // Every provider in the chain unconfigured/failed -- caller falls back
    // to a keyword scene, so this is non-fatal, but still worth a log line:
    // a silent fallback here previously gave no signal that the art
    // director ladder stopped actually running.
    logEvent('warn', 'publish', 'Art director ladder failed -- falling back to keyword scene', {
      role,
      ...serializeErrorDetails(error),
    });
  }
  return null;
}

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
  const result = await runArtDirectorLadder(instruction, 'daily.card_image_scene', cfg);
  if (result) return { scene: result.text, source: result.source };
  return { scene: fallbackScene(ctx), source: 'fallback' };
}

// ---------------------------------------------------------------------------
// Weekly Digest "editorial concept" illustrations (prompt-v3).
// Pivot from documentary reportage-v2: find the story's ESSENCE, invent a
// visual METAPHOR that argues that essence, then render subject-first SASC
// for FLUX.2 (BFL-aligned). dual_contrast compositions allowed when the
// argument needs facade-vs-chaos / tiny-vs-huge spatial divide -- still one
// continuous photograph, never collage or readable UI.
// ---------------------------------------------------------------------------

/** Stored on story_image artifacts; bump when house-style / gates change. */
export const WEEKLY_PROMPT_POLICY = 'weekly-editorial-concept-v2';

/** Open vocabulary motif label from the metaphor director (snake_case). */
export type MetaphorSubjectKind = 'object' | 'process' | 'environment' | 'character';

/** Sibling story metaphors already committed in this digest (structural diversity). */
export interface SiblingMetaphorHint {
  motifClass?: string;
  subjectKind?: string;
  composition?: 'single' | 'dual_contrast';
  sceneSummary: string;
}

export interface WeeklyReportageSceneInput {
  headline: string;
  summary: string;
  /** First ~600 chars of the story body. */
  bodyExcerpt?: string;
  editorsView?: string;
  /** Binding editorial angle from weekly_digest_story_directions (PR4). */
  editorialAngle?: string;
  /** Why-it-matters line -- distinctive claim for entity extraction. */
  why?: string;
  /** Short claim snippets from research (optional). */
  claimsExcerpt?: string;
  /** Subjects already used by sibling stories in this digest (diversity). */
  avoidSubjects?: string[];
  /** Rich sibling metaphor metadata for motif/composition/character gates. */
  siblingMetaphors?: SiblingMetaphorHint[];
}

/** One-sentence editorial argument the illustration must make. */
export interface EditorialEssence {
  essence: string;
  mustFeel: string;
  forbiddenCliches: string[];
}

/** A concrete visual metaphor that expresses an essence. */
export interface MetaphorPitch {
  title: string;
  subject: string;
  action: string;
  setting: string;
  props: string[];
  composition: 'single' | 'dual_contrast';
  whyItFits: string;
  /** Open snake_case class, e.g. anthropomorphic_guardian, thermal_waste. */
  motifClass: string;
  subjectKind: MetaphorSubjectKind;
}

/** Validated frame ready to flatten into a FLUX scene phrase. */
export interface WeeklyEditorialFrame {
  essence: string;
  metaphorTitle: string;
  subject: string;
  action: string;
  setting: string;
  props: string[];
  composition: 'single' | 'dual_contrast';
  mustInclude: string[];
  motifClass: string;
  subjectKind: MetaphorSubjectKind;
}

/** Token Jaccard threshold for sibling scene echo (0–1). */
export const SIBLING_SCENE_ECHO_THRESHOLD = 0.45;

/** Compatibility shape for older tests; prefer MetaphorPitch. */
export interface WeeklyReportageSceneSpec {
  subject: string;
  action: string;
  setting: string;
  props: string[];
  mustInclude: string[];
}

/** Hard bans: readable UI, AI sludge stock, comic collage. */
const WEEKLY_CRAFT_BANNED =
  /\b(npx\b|terminal(?:\s+window)?|ide\b|vs\s*code|dashboard|taskbar|browser chrome|title bar|readable (?:ui|text|screen|code)|gibberish|glowing brain|cracked padlock|robotic arms?|coin towers?|finger pointing|pointing at (?:the )?screen|neural[-\s]?network mesh|comic panel|collage|split[-\s]?screen)\b/i;

/** Paper/transcript heaps that klein renders as melted AI sludge. */
const WEEKLY_SLUDGE_BANNED =
  /\b(heap of (?:paper|papers|transcript|transcripts)|tall stack of|stack of (?:paper|papers|transcript|books)|melted|deformed|warped pages|illegible (?:pages|paper))\b/i;

const WEEKLY_DESK_DEFAULT =
  /\b(desk|laptop|keyboard|monitor|trackpad|office chair)\b/i;

function stripArtDirectorFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonObject(text: string): unknown | null {
  const cleaned = stripArtDirectorFences(text);
  const tryParse = (candidate: string): unknown | null => {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }
  };
  const direct = tryParse(cleaned);
  if (direct) return direct;
  const braced = cleaned.match(/\{[\s\S]*\}/);
  if (braced) return tryParse(braced[0]);
  const arrayed = cleaned.match(/\[[\s\S]*\]/);
  if (arrayed) return tryParse(arrayed[0]);
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim());
}

/** Map house accent names (or raw hex) to a FLUX.2-friendly HEX token. */
export function accentToHex(accent: string): string {
  const raw = accent.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.startsWith('#') ? raw.toUpperCase() : `#${raw.toUpperCase()}`;
  }
  const key = raw.toLowerCase();
  if (key.includes('cyan') || key.includes('teal') || key.includes('cool')) return '#22D3EE';
  if (key.includes('amber') || key.includes('warm') || key.includes('orange')) return '#F59E0B';
  if (key.includes('violet') || key.includes('purple')) return '#A78BFA';
  if (key.includes('green')) return '#34D399';
  if (key.includes('red') || key.includes('rose')) return '#FB7185';
  return '#22D3EE';
}

export function extractWeeklyStoryEntities(input: WeeklyReportageSceneInput): string[] {
  const out: string[] = [];
  const headline = input.headline.trim();
  const lead = headline.split(/[—–:\-|]/)[0]?.trim() || headline;
  if (lead) out.push(lead.slice(0, 80));
  for (const match of headline.match(
    /\b(?:[A-Z][a-z]+(?:[A-Z][a-zA-Z0-9]*)+|[A-Z]{2,}[a-zA-Z0-9]*|Claude|Codex|Stripe|Cloudflare|Meta|Gemini|GPT)\b/g,
  ) ?? []) {
    out.push(match);
  }
  const lower = `${headline} ${input.summary}`.toLowerCase();
  if (/\b(3d\s+game|video\s*game|game\s+engine)\b/.test(lower)) out.push('3D game');
  if (/\b(browser|headless)\b/.test(lower)) out.push('browser');
  if (/\b(plugin|package)\b/.test(lower)) out.push('plugin');
  if (/\b(agent|sub-?agents?)\b/.test(lower)) out.push('coding agent');
  if (/\b(energ|watt|600x|token)\b/.test(lower)) out.push('energy');
  if (input.editorialAngle?.trim()) out.push(input.editorialAngle.trim().slice(0, 72));
  return [...new Set(out.map((s) => s.trim()).filter((s) => s.length >= 3))].slice(0, 8);
}

function entityMentioned(haystack: string, entity: string): boolean {
  const tokens = entity
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
  if (!tokens.length) return haystack.includes(entity.toLowerCase().slice(0, 12));
  let best = tokens[0]!;
  for (const token of tokens) {
    if (token.length > best.length) best = token;
  }
  return haystack.includes(best);
}

function buildWeeklyContextBlock(input: WeeklyReportageSceneInput, entities: string[]): string {
  return [
    `Headline: "${input.headline}"`,
    `Summary: "${input.summary}"`,
    input.bodyExcerpt?.trim()
      ? `Story excerpt: "${input.bodyExcerpt.trim().slice(0, 600)}"`
      : null,
    input.editorsView?.trim()
      ? `Editor's read on where this leads: "${input.editorsView.trim()}"`
      : null,
    input.editorialAngle?.trim()
      ? `Binding editorial angle: "${input.editorialAngle.trim()}"`
      : null,
    input.why?.trim() ? `Why it matters: "${input.why.trim().slice(0, 280)}"` : null,
    input.claimsExcerpt?.trim()
      ? `Key claims: "${input.claimsExcerpt.trim().slice(0, 400)}"`
      : null,
    entities.length ? `Story entities to honor: ${entities.join(' | ')}` : null,
    input.avoidSubjects?.length
      ? `Do not reuse these sibling-story subjects: ${input.avoidSubjects.join(' | ')}`
      : null,
    formatSiblingMetaphorBlock(input.siblingMetaphors),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatSiblingMetaphorBlock(siblings: SiblingMetaphorHint[] | undefined): string | null {
  if (!siblings?.length) return null;
  const lines = siblings.slice(0, 8).map((sibling, index) => {
    const bits = [
      sibling.motifClass ? `motif_class=${sibling.motifClass}` : null,
      sibling.subjectKind ? `subject_kind=${sibling.subjectKind}` : null,
      sibling.composition ? `composition=${sibling.composition}` : null,
      `scene=${sibling.sceneSummary.slice(0, 140)}`,
    ].filter(Boolean);
    return `  ${index + 1}. ${bits.join('; ')}`;
  });
  return [
    'Sibling metaphors already used in this digest (do NOT rhyme with these):',
    ...lines,
    'Pick a fresh motif_class. Prefer object/process/environment over another character if a character sibling already exists. At most one dual_contrast composition per digest.',
  ].join('\n');
}

const SUBJECT_KINDS = new Set<MetaphorSubjectKind>([
  'object',
  'process',
  'environment',
  'character',
]);

function normalizeMotifClass(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function parseSubjectKind(raw: unknown): MetaphorSubjectKind {
  if (typeof raw !== 'string') return 'object';
  const key = raw.trim().toLowerCase() as MetaphorSubjectKind;
  return SUBJECT_KINDS.has(key) ? key : 'object';
}

/** Significant tokens for sibling scene echo (Jaccard). */
export function tokenizeSceneForEcho(text: string): Set<string> {
  const stop = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'of',
    'in',
    'on',
    'at',
    'to',
    'for',
    'with',
    'from',
    'into',
    'over',
    'under',
    'vs',
    'versus',
  ]);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !stop.has(t));
  return new Set(tokens);
}

export function jaccardTokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const token of a) {
    if (b.has(token)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function pitchSceneBlob(pitch: MetaphorPitch): string {
  return [pitch.subject, pitch.setting, ...pitch.props].join(' ');
}

function dualContrastIsArgued(whyItFits: string): boolean {
  if (whyItFits.trim().length < 28) return false;
  return /\b(vs\.?|versus|while|against|but|both|facade|front|back|left|right|tiny|huge|small|large|polished|broken|hidden|visible)\b/i.test(
    whyItFits,
  );
}

export function parseEditorialEssence(raw: string): EditorialEssence | null {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const essence =
    typeof record.essence === 'string'
      ? record.essence.trim()
      : typeof record.argument === 'string'
        ? record.argument.trim()
        : '';
  if (essence.length < 12) return null;
  const mustFeel =
    typeof record.must_feel === 'string'
      ? record.must_feel.trim()
      : typeof record.mustFeel === 'string'
        ? record.mustFeel.trim()
        : 'sharp editorial tension';
  return {
    essence,
    mustFeel: mustFeel || 'sharp editorial tension',
    forbiddenCliches: asStringArray(record.forbidden_cliches ?? record.forbiddenCliches),
  };
}

export function parseMetaphorPitches(raw: string): MetaphorPitch[] {
  const parsed = extractJsonObject(raw);
  let rows: unknown[] = [];
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.metaphors)) rows = record.metaphors;
    else if (Array.isArray(record.pitches)) rows = record.pitches;
    else rows = [parsed];
  }
  const pitches: MetaphorPitch[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const subject = typeof record.subject === 'string' ? record.subject.trim() : '';
    if (subject.length < 8) continue;
    const compositionRaw =
      typeof record.composition === 'string' ? record.composition.trim().toLowerCase() : 'single';
    const composition: MetaphorPitch['composition'] =
      compositionRaw === 'dual_contrast' || compositionRaw === 'dual' ? 'dual_contrast' : 'single';
    pitches.push({
      title: (typeof record.title === 'string' && record.title.trim()) || subject.slice(0, 48),
      subject,
      action:
        (typeof record.action === 'string' && record.action.trim()) ||
        'embodying the story argument',
      setting:
        (typeof record.setting === 'string' && record.setting.trim()) ||
        'an editorial symbolic space',
      props: asStringArray(record.props),
      composition,
      whyItFits:
        (typeof record.why_it_fits === 'string' && record.why_it_fits.trim()) ||
        (typeof record.whyItFits === 'string' && record.whyItFits.trim()) ||
        '',
      motifClass: normalizeMotifClass(
        (typeof record.motif_class === 'string' && record.motif_class) ||
          (typeof record.motifClass === 'string' && record.motifClass) ||
          subject.slice(0, 32),
      ),
      subjectKind: parseSubjectKind(record.subject_kind ?? record.subjectKind),
    });
  }
  return pitches.slice(0, 3);
}

export function flattenMetaphorPitch(pitch: MetaphorPitch, essence?: string): string {
  const props = pitch.props.filter(Boolean).join(', ');
  const dualNote =
    pitch.composition === 'dual_contrast'
      ? 'one continuous photograph with a clear spatial divide (facade versus backstage), not a collage'
      : '';
  return [
    pitch.subject,
    pitch.action,
    pitch.setting,
    props ? `with ${props}` : '',
    dualNote,
    essence ? `arguing: ${essence}` : '',
  ]
    .filter(Boolean)
    .join(', ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);
}

export function parseWeeklySceneSpec(raw: string): WeeklyReportageSceneSpec | null {
  const pitches = parseMetaphorPitches(raw);
  if (pitches[0]) {
    return {
      subject: pitches[0].subject,
      action: pitches[0].action,
      setting: pitches[0].setting,
      props: pitches[0].props,
      mustInclude: [],
    };
  }
  const phrase = cleanSceneText(raw);
  if (phrase.length < 12) return null;
  return {
    subject: phrase,
    action: 'embodying the story argument',
    setting: 'an editorial symbolic space',
    props: [],
    mustInclude: [],
  };
}

export function flattenWeeklySceneSpec(spec: WeeklyReportageSceneSpec): string {
  const props = spec.props.filter(Boolean).join(', ');
  return [spec.subject, spec.action, spec.setting, props ? `with ${props}` : '']
    .filter(Boolean)
    .join(', ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

export function validateMetaphorPitch(
  pitch: MetaphorPitch,
  essence: EditorialEssence,
  requiredEntities: string[],
  siblings: SiblingMetaphorHint[] = [],
): string[] {
  const errors: string[] = [];
  const flat = [
    pitch.title,
    pitch.subject,
    pitch.action,
    pitch.setting,
    ...pitch.props,
    pitch.whyItFits,
  ].join(' ');
  if (pitch.subject.trim().length < 8) errors.push('subject too short');
  if (!pitch.motifClass || pitch.motifClass.length < 3) {
    errors.push('motif_class missing or too short');
  }
  if (WEEKLY_CRAFT_BANNED.test(flat)) {
    errors.push('banned UI, collage, or stock-metaphor language');
  }
  if (WEEKLY_SLUDGE_BANNED.test(flat)) {
    errors.push('banned paper-heap / sludge props that klein renders poorly');
  }
  if (pitch.composition === 'dual_contrast') {
    const hasDivide =
      /\b(left|right|facade|backstage|curtain|behind|reflection|foreground|background|two (?:rooms|spaces)|spatial divide)\b/i.test(
        flat,
      );
    if (!hasDivide) {
      errors.push('dual_contrast requires clear spatial-divide language');
    }
    if (!dualContrastIsArgued(pitch.whyItFits)) {
      errors.push('dual_contrast_unargued');
    }
  }
  const hay = flat.toLowerCase();
  const essenceHit =
    essence.essence
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 5)
      .slice(0, 4)
      .some((token) => hay.includes(token)) || pitch.whyItFits.length >= 12;
  if (!essenceHit) {
    errors.push('metaphor does not clearly argue the essence');
  }
  const entityHit =
    requiredEntities.length === 0 ||
    requiredEntities.some((entity) => entityMentioned(hay, entity));
  if (requiredEntities.length > 0 && !entityHit) {
    errors.push(`scene missing story entities (${requiredEntities.slice(0, 3).join(', ')})`);
  }
  if (
    WEEKLY_DESK_DEFAULT.test(flat) &&
    pitch.composition === 'single' &&
    !/\b(heat|watt|controller|furnace|turbine|scale|orb|valve|chassis|keystone|vault|circuit)\b/i.test(
      flat,
    )
  ) {
    errors.push('desk/laptop default without a strong conceptual prop');
  }
  for (const cliche of essence.forbiddenCliches) {
    if (cliche.trim().length >= 4 && hay.includes(cliche.toLowerCase())) {
      errors.push(`hits forbidden cliche: ${cliche}`);
    }
  }

  const motif = pitch.motifClass.toLowerCase();
  if (siblings.some((s) => s.motifClass && s.motifClass.toLowerCase() === motif)) {
    errors.push('sibling_motif_class_reuse');
  }
  const pitchTokens = tokenizeSceneForEcho(pitchSceneBlob(pitch));
  for (const sibling of siblings) {
    const overlap = jaccardTokenOverlap(
      pitchTokens,
      tokenizeSceneForEcho(sibling.sceneSummary),
    );
    if (overlap >= SIBLING_SCENE_ECHO_THRESHOLD) {
      errors.push('sibling_scene_echo');
      break;
    }
  }
  const siblingHasCharacter = siblings.some(
    (s) => (s.subjectKind ?? '').toLowerCase() === 'character',
  );
  if (siblingHasCharacter && pitch.subjectKind === 'character') {
    errors.push('character_budget');
  }
  const siblingHasDual = siblings.some((s) => s.composition === 'dual_contrast');
  if (siblingHasDual && pitch.composition === 'dual_contrast') {
    errors.push('dual_contrast_digest_cap');
  }

  return errors;
}

/** Compatibility wrapper for older call sites/tests. */
export function validateWeeklySceneSpec(
  spec: WeeklyReportageSceneSpec,
  requiredEntities: string[],
): string[] {
  return validateMetaphorPitch(
    {
      title: spec.subject.slice(0, 40),
      subject: spec.subject,
      action: spec.action,
      setting: spec.setting,
      props: spec.props,
      composition: 'single',
      whyItFits: 'legacy scene spec',
      motifClass: 'legacy_scene',
      subjectKind: 'object',
    },
    { essence: requiredEntities[0] || 'story argument', mustFeel: '', forbiddenCliches: [] },
    requiredEntities,
  );
}

/**
 * Essence-aware keyword fallback -- conceptual metaphors, never desk blink
 * boxes or daily padlock/robot-arm leftovers.
 */
export function weeklyFallbackScene(text: string, entities: string[] = []): string {
  const t = text.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => t.includes(w));
  const cue = entities.find((e) => e.length <= 40) ?? entities[0] ?? '';
  const prefix = cue ? `${cue}: ` : '';
  if (has('energy', 'watt', '600x', 'token', 'burn', 'stripe', 'claude')) {
    return `${prefix}a tiny chat bubble beside a towering industrial furnace of wasted heat, scale contrast, no readable text`;
  }
  if (has('game', '3d', 'render', 'bug', 'quality', '52 minute', 'codex')) {
    return `${prefix}polished game character on a lit stage left, unfinished pink-black missing-texture props and wooden braces backstage right, one continuous photograph`;
  }
  if (has('muse', 'unsupervised', '24 hour', 'journal', 'kernel', 'endurance', 'agent')) {
    return `${prefix}a tireless fairytale workshop character juggling glowing task orbs while guarding a sleek sealed journal ledger, no screens`;
  }
  if (has('browser', 'headless', 'kitesurf', 'edge')) {
    return `${prefix}a stripped racing chassis without seats or mirrors speeding through fog, implying headless software`;
  }
  if (has('security', 'cve', 'breach', 'vulnerab')) {
    return `${prefix}a glass vault wall spiderweb-cracking under pressure while an alarm light blooms, no logos`;
  }
  if (has('plugin', 'package', 'release', 'launch')) {
    return `${prefix}a precision keystone locking into an arch of modular blocks, soft dusk light`;
  }
  if (has('tutor', 'teach', 'education', 'research')) {
    return `${prefix}a weighing scale balancing a glowing decision pebble against a stack of blank tutoring cards`;
  }
  return `${prefix}a single symbolic object under a hard editorial spotlight arguing the story claim, photoreal materials, no screens`;
}

async function runArtDirectorRaw(
  instruction: string,
  role: ProviderRole,
  cfg: CardImageConfig,
): Promise<{ text: string; source: string } | null> {
  try {
    const registry = await resolveSceneRegistry(cfg);
    const result = await generateWithRegistry(role, instruction, registry);
    const text = stripArtDirectorFences(result.text).replace(/\s+/g, ' ').trim();
    if (text.length >= 6) return { text, source: result.provider };
  } catch (error) {
    logEvent('warn', 'publish', 'Art director ladder failed -- falling back to keyword scene', {
      role,
      ...serializeErrorDetails(error),
    });
  }
  return null;
}

function buildEssenceInstruction(input: WeeklyReportageSceneInput, entities: string[]): string {
  return (
    `You are the editorial director for a developer technology digest. Read the story and state ` +
    `the ONE argument the cover illustration must make -- not logistics of who sat where. ` +
    `Examples of good essence: "Agentic coding burns vastly more energy than a chat prompt, often invisibly"; ` +
    `"An unsupervised agent stays reliable because of its durable task journal"; ` +
    `"Shipping speed outran quality -- a finished facade hides broken internals". ` +
    `Reply with ONLY JSON: {"essence":"one sentence","must_feel":"emotional register",` +
    `"forbidden_cliches":["desk with laptop","generic AI brain",...]}.\n\n` +
    buildWeeklyContextBlock(input, entities)
  );
}

function buildMetaphorInstruction(
  input: WeeklyReportageSceneInput,
  essence: EditorialEssence,
  entities: string[],
  priorErrors?: string[],
): string {
  const retry = priorErrors?.length
    ? `\nPrevious pitches failed: ${priorErrors.join('; ')}. Propose corrected metaphors.\n`
    : '';
  return (
    `You design cover metaphors for a weekly AI/engineering digest. Given this essence, invent ` +
    `2 or 3 vivid visual metaphors a reader grasps without reading any screen text. ` +
    `Prefer concrete OBJECTS, PROCESSES, or ENVIRONMENTS that argue the essence. ` +
    `Use a CHARACTER only when the essence cannot be read without one. ` +
    `Do NOT default to theater stages, ballerinas, golems, sealed journals, or ledgers unless ` +
    `the essence uniquely requires that exact mechanism -- invent a fresh motif_class each time. ` +
    `If the essence needs contrast, set composition to "dual_contrast" and name BOTH halves in ` +
    `why_it_fits (facade vs chaos, tiny vs huge) as ONE continuous photograph with a spatial divide -- ` +
    `never collage, never a decorative second beat that does not argue the essence. ` +
    `At most one dual_contrast per digest (see sibling metaphors). Screens if any stay blank unmarked glow. ` +
    `No logos, no readable UI, no real celebrity faces. ` +
    `Reply with ONLY JSON: {"metaphors":[{"title":"","subject":"","action":"","setting":"",` +
    `"props":[],"composition":"single|dual_contrast","motif_class":"snake_case_label",` +
    `"subject_kind":"object|process|environment|character","why_it_fits":""}]}.\n\n` +
    `Essence: "${essence.essence}"\nMust feel: "${essence.mustFeel}"\n` +
    `Forbidden: ${essence.forbiddenCliches.join(' | ') || 'generic AI sludge'}\n` +
    `${buildWeeklyContextBlock(input, entities)}${retry}`
  );
}

function scoreMetaphorPitch(
  pitch: MetaphorPitch,
  essence: EditorialEssence,
  siblings: SiblingMetaphorHint[] = [],
): number {
  let score = 0;
  if (pitch.whyItFits.length >= 20) score += 2;
  if (pitch.props.length >= 1) score += 1;
  if (
    pitch.subjectKind === 'object' ||
    pitch.subjectKind === 'process' ||
    pitch.subjectKind === 'environment'
  ) {
    score += 2;
  }
  if (pitch.subjectKind === 'character') score -= 1;
  if (WEEKLY_DESK_DEFAULT.test(pitch.subject)) score -= 2;
  if (
    essence.mustFeel &&
    pitch.whyItFits.toLowerCase().includes(essence.mustFeel.toLowerCase().slice(0, 8))
  ) {
    score += 1;
  }
  const motif = pitch.motifClass.toLowerCase();
  for (const sibling of siblings) {
    if (sibling.motifClass && sibling.motifClass.toLowerCase() === motif) score -= 4;
    const overlap = jaccardTokenOverlap(
      tokenizeSceneForEcho(pitchSceneBlob(pitch)),
      tokenizeSceneForEcho(sibling.sceneSummary),
    );
    if (overlap >= SIBLING_SCENE_ECHO_THRESHOLD) score -= 3;
  }
  return score;
}

export async function extractEditorialEssence(
  input: WeeklyReportageSceneInput,
  cfg: CardImageConfig,
): Promise<{ essence: EditorialEssence; source: string } | null> {
  const entities = extractWeeklyStoryEntities(input);
  const result = await runArtDirectorRaw(
    buildEssenceInstruction(input, entities),
    'weekly.card_image_scene',
    cfg,
  );
  if (!result) return null;
  const essence = parseEditorialEssence(result.text);
  if (!essence) return null;
  return { essence, source: result.source };
}

/**
 * Essence → metaphor brief with validation + one metaphor retry.
 * Falls back to {@link weeklyFallbackScene} conceptual keywords.
 */
export async function weeklyReportageSceneBrief(
  input: WeeklyReportageSceneInput,
  cfg: CardImageConfig,
): Promise<
  SceneBriefResult & {
    essence?: string;
    metaphorTitle?: string;
    motifClass?: string;
    subjectKind?: MetaphorSubjectKind;
    composition?: MetaphorPitch['composition'];
  }
> {
  const ctx = [input.headline, input.summary].filter(Boolean).join('. ').trim();
  if (!ctx) return { scene: DEFAULT_SCENE, source: 'fallback' };
  const entities = extractWeeklyStoryEntities(input);
  const siblings = input.siblingMetaphors ?? [];

  const essenceResult = await extractEditorialEssence(input, cfg);
  const essence: EditorialEssence = essenceResult?.essence ?? {
    essence: ctx.slice(0, 160),
    mustFeel: 'editorial tension',
    forbiddenCliches: ['person at laptop desk', 'glowing brain', 'paper heap'],
  };
  const essenceSource = essenceResult?.source;

  let lastErrors: string[] | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await runArtDirectorRaw(
      buildMetaphorInstruction(input, essence, entities, lastErrors),
      'weekly.card_image_scene',
      cfg,
    );
    if (!result) break;
    const pitches = parseMetaphorPitches(result.text);
    if (!pitches.length) {
      lastErrors = ['no parseable metaphors'];
      continue;
    }
    const ranked = [...pitches].sort(
      (a, b) =>
        scoreMetaphorPitch(b, essence, siblings) - scoreMetaphorPitch(a, essence, siblings),
    );
    let chosen: MetaphorPitch | null = null;
    const aggregateErrors: string[] = [];
    for (const pitch of ranked) {
      const errors = validateMetaphorPitch(pitch, essence, entities, siblings);
      if (errors.length === 0) {
        chosen = pitch;
        break;
      }
      aggregateErrors.push(`${pitch.title}: ${errors.join(', ')}`);
    }
    if (chosen) {
      return {
        scene: flattenMetaphorPitch(chosen, essence.essence),
        source: result.source || essenceSource || 'fallback',
        essence: essence.essence,
        metaphorTitle: chosen.title,
        motifClass: chosen.motifClass,
        subjectKind: chosen.subjectKind,
        composition: chosen.composition,
      };
    }
    lastErrors = aggregateErrors.slice(0, 3);
    logEvent('warn', 'publish', 'Weekly metaphors failed validation -- retrying', {
      attempt: attempt + 1,
      errors: lastErrors,
    });
  }

  return {
    scene: weeklyFallbackScene(ctx, entities),
    source: 'fallback',
    essence: essence.essence,
  };
}

/**
 * FLUX.2 weekly image prompt (policy {@link WEEKLY_PROMPT_POLICY}).
 * Subject-first SASC, craft-focused (photoreal materials, no sludge heaps).
 */
export function buildEditorialConceptPrompt(accent: string, scene: string): string {
  const subject = scene.replace(/\s+/g, ' ').trim();
  const hex = accentToHex(accent.trim() || 'cool cyan');
  return (
    `${subject}. ` +
    `Editorial concept illustration for a technology magazine cover, photoreal materials, ` +
    `clear silhouette, believable physics, shot on 35mm lens, dramatic available light, ` +
    `shallow depth of field, restrained grade with accent color ${hex}, wide 16:9 edge-to-edge, ` +
    `calm empty top and bottom bands, unmarked blank surfaces only, no deformed stacks, ` +
    `sharp focus on the subject.`
  );
}

/** Alias kept for existing imports/tests. */
export function buildWeeklyPrompt(accent: string, scene: string): string {
  return buildEditorialConceptPrompt(accent, scene);
}

export interface WeeklyReportageIllustrationInput extends WeeklyReportageSceneInput {
  accent?: string;
  /** No job.id here on purpose -- stable across regenerations. */
  seedBase: string;
  /** Owner-edited scene text bypasses essence/metaphor calls. */
  sceneOverride?: string;
  /** Defaults to 3. */
  variantCount?: number;
}

export interface WeeklyReportageIllustrationResult {
  variants: GeneratedImageResult[];
  scene: string;
  sceneSource: SceneSource;
  essence?: string;
  metaphorTitle?: string;
  motifClass?: string;
  subjectKind?: MetaphorSubjectKind;
  composition?: MetaphorPitch['composition'];
}

/** Generates variant renders of the same editorial-concept scene. */
export async function generateWeeklyReportageIllustrations(
  input: WeeklyReportageIllustrationInput,
  cfg: CardImageConfig,
): Promise<WeeklyReportageIllustrationResult | null> {
  const override = input.sceneOverride?.trim();
  let scene: string;
  let sceneSource: SceneSource;
  let essence: string | undefined;
  let metaphorTitle: string | undefined;
  let motifClass: string | undefined;
  let subjectKind: MetaphorSubjectKind | undefined;
  let composition: MetaphorPitch['composition'] | undefined;
  if (override) {
    scene = cleanSceneText(override);
    sceneSource = 'owner';
    const ownerErrors = validateMetaphorPitch(
      {
        title: 'owner-override',
        subject: scene,
        action: '',
        setting: '',
        props: [],
        composition: /facade|backstage|left|right|spatial divide/i.test(scene)
          ? 'dual_contrast'
          : 'single',
        whyItFits: 'owner override',
        motifClass: 'owner_override',
        subjectKind: 'object',
      },
      { essence: input.headline || 'story', mustFeel: '', forbiddenCliches: [] },
      extractWeeklyStoryEntities(input),
      input.siblingMetaphors,
    );
    if (ownerErrors.length) {
      logEvent('warn', 'publish', 'Owner scene_override failed weekly gates (using anyway)', {
        errors: ownerErrors,
      });
    }
  } else {
    const brief = await weeklyReportageSceneBrief(input, cfg);
    scene = brief.scene;
    sceneSource = brief.source;
    essence = brief.essence;
    metaphorTitle = brief.metaphorTitle;
    motifClass = brief.motifClass;
    subjectKind = brief.subjectKind;
    composition = brief.composition;
  }
  const positive = buildEditorialConceptPrompt(input.accent?.trim() || 'cool cyan', scene);
  const negative = negativePrompt();
  const count = Math.max(1, input.variantCount ?? 3);
  const variants: GeneratedImageResult[] = [];
  for (let i = 1; i <= count; i += 1) {
    const seed = seedFromString(`${input.seedBase}:v${i}`);
    const generated = await generateImage(positive, negative, cfg, seed);
    if (generated) {
      variants.push({
        ...generated,
        scene,
        positivePrompt: positive,
        negativePrompt: negative,
        sceneSource,
      });
    }
  }
  return variants.length
    ? {
        variants,
        scene,
        sceneSource,
        essence,
        metaphorTitle,
        motifClass,
        subjectKind,
        composition,
      }
    : null;
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
