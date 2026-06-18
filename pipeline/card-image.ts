/**
 * Per-item brand card images. For each freshly published brief item we generate
 * a unique cinematic illustration from its headline (a tiny Gemini text call
 * turns the title into a visual metaphor → a constant cinematic house-style
 * prompt, accented by the item's category colour), store it in the `card-images`
 * Storage bucket, and record the public URL on `brief_items.card_image_url`.
 *
 * Generation is FREE and never blocks the brief: Cloudflare Workers AI FLUX is
 * the primary provider, Pollinations the fallback, and when both fail the item
 * keeps a null URL so the OG card renders its branded duotone fallback instead.
 * Runs post-publish and skips items that already have an image, so re-running the
 * pipeline (every 30-min slot) never regenerates or double-charges.
 */

import { createHash } from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PipelineDb } from './db';
import { logEvent } from './log';

const BUCKET = 'card-images';
const CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const FALLBACK_ACCENT = '#5bc9f0';

export interface CardImageConfig {
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  geminiApiKey: string;
  /** Text model for the metaphor step (default gemini-2.5-flash). */
  geminiModel?: string;
  /** OpenRouter key — metaphor fallback when the Gemini free tier is rate-limited. */
  openRouterApiKey?: string;
}

export interface FillCardImagesResult {
  generated: number;
  skipped: number;
  failed: number;
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
    .select('id, slug, title_en, title_uk, category_slug, card_image_url, review_status')
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
  for (const it of pending) {
    try {
      const title = (it.title_en || it.title_uk || '').trim();
      const accent = hueName(colorBySlug.get(it.category_slug ?? '') ?? FALLBACK_ACCENT);
      const metaphor = await visualMetaphor(title, cfg);
      const prompt = buildPrompt(accent, metaphor);
      const png = await generateImage(prompt, cfg, seedFromString(it.slug!));
      if (!png) {
        failed++;
        logEvent('warn', 'publish', 'Card image generation returned nothing', { slug: it.slug });
        continue;
      }
      const url = await uploadCardImage(db, it.slug!, png);
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
        logEvent('warn', 'publish', 'Card image url update failed', { slug: it.slug, error: updErr.message });
        continue;
      }
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

/** Cinematic house style (constant) + category accent + per-item metaphor. */
export function buildPrompt(accent: string, metaphor: string): string {
  return (
    `A cinematic, moody editorial key visual for a premium AI news brief. ` +
    `Near-black background, dramatic volumetric lighting, ${accent} as the dominant accent colour ` +
    `with a subtle warm-gold secondary highlight, shallow depth of field, expensive cinematic look, ` +
    `generous negative space toward the bottom, edge-to-edge full-bleed, absolutely no border, no frame, ` +
    `no margin, no text, no words, no letters, no numbers, no logos, no watermark, no user interface. ` +
    `Subject: ${metaphor} Wide 16:9 horizontal composition.`
  );
}

/**
 * Turn a headline into a CONCRETE cover-illustration brief — a clear focal
 * subject a reader instantly connects to the story, not vague abstraction.
 * Falls back to the title itself if the model call fails.
 */
export async function visualMetaphor(title: string, cfg: CardImageConfig): Promise<string> {
  if (!title) return 'a luminous crystalline AI core on a dark stage';
  const instruction =
    `You are the art director for a developer-focused tech news magazine. Describe ONE clear, ` +
    `concrete cover illustration that instantly conveys THIS story — a specific focal subject, ` +
    `setting and action representing the real topic. Lean on recognizable symbols: a company as a ` +
    `monumental glowing tower, a person as a luminous silhouette, a move/hire as a figure crossing ` +
    `between two structures, a launch as a rocket or opening portal, funding as flowing light or ` +
    `coins, a model as a radiant crystalline brain, agents as cooperating robotic arms, a security ` +
    `flaw as a cracked glowing shield, a benchmark as glowing bars. Avoid vague abstraction. ` +
    `No text, words, letters, numbers, brand logos or recognizable real faces. ` +
    `18-28 words, concrete nouns, one clear focal subject, not a sentence. Headline: "${title}"`;
  const clean = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 300);
  const model = cfg.geminiModel || process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

  // Primary: Gemini. Fallback: OpenRouter (different billing → survives Gemini
  // free-tier rate limits, e.g. during a backfill). Last resort: the title.
  try {
    const r = await new GoogleGenerativeAI(cfg.geminiApiKey)
      .getGenerativeModel({ model })
      .generateContent(instruction);
    const text = clean(r.response.text());
    if (text.length >= 6) return text;
  } catch {
    /* fall through to OpenRouter */
  }

  if (cfg.openRouterApiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.openRouterApiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: `google/${model}`, messages: [{ role: 'user', content: instruction }] }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = clean(data.choices?.[0]?.message?.content ?? '');
        if (text.length >= 6) return text;
      }
    } catch {
      /* fall through to title */
    }
  }

  return title;
}

async function generateImage(
  prompt: string,
  cfg: CardImageConfig,
  seed: number,
): Promise<Buffer | null> {
  return (await generateCloudflare(prompt, cfg)) ?? (await generatePollinations(prompt, seed));
}

/** Primary: Cloudflare Workers AI FLUX-schnell (free tier). */
async function generateCloudflare(prompt: string, cfg: CardImageConfig): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfg.cloudflareAccountId}/ai/run/${CF_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.cloudflareApiToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ prompt, steps: 6 }),
      },
    );
    if (!res.ok) {
      logEvent('warn', 'publish', 'Cloudflare image gen failed', { status: res.status });
      return null;
    }
    const data = (await res.json()) as { result?: { image?: string } };
    const b64 = data.result?.image;
    return b64 ? Buffer.from(b64, 'base64') : null;
  } catch {
    return null;
  }
}

/** Fallback: Pollinations FLUX (no key, public — native 16:9). */
async function generatePollinations(prompt: string, seed: number): Promise<Buffer | null> {
  try {
    const url =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
      `?width=1216&height=640&model=flux&nologo=true&seed=${seed}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 1024 ? buf : null;
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
