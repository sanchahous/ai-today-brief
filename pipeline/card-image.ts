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
 *   2. Cloudflare Workers AI Leonardo "Lucid Origin" — strong default, uses the
 *      already-configured CF creds, native 16:9 + negative prompts.
 *   3. Cloudflare FLUX-1-schnell — always-free spillover (e.g. once the day's
 *      Workers-AI neuron budget for the premium model is spent).
 *   4. Pollinations FLUX — last-resort public fallback.
 * When all fail the item keeps a null URL and the OG card renders its branded
 * duotone fallback. Runs post-publish, idempotent (skips items that already have
 * an image), so re-running the pipeline never regenerates or double-charges.
 */

import { createHash } from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PipelineDb } from './db';
import { logEvent } from './log';

const BUCKET = 'card-images';
/** Best Cloudflare Workers AI image model by default; override with CLOUDFLARE_IMAGE_MODEL. */
export const DEFAULT_CF_IMAGE_MODEL = '@cf/leonardo/lucid-origin';
/** Always-free distilled FLUX — the spillover once a premium CF model is unavailable. */
const SCHNELL_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const FALLBACK_ACCENT = '#5bc9f0';
/** 16:9 render size; crops cleanly to the 1200×630 OG card and the 92px feed thumb. */
const IMG_W = 1280;
const IMG_H = 720;
/** Safety cap: most a single run will spend per brief (idempotency bounds it anyway). */
const MAX_PER_RUN = 12;

export interface CardImageConfig {
  /** Cloudflare account id + Workers AI token (optional — CF tiers skip when unset). */
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  geminiApiKey: string;
  /** Text model for the scene step (default gemini-2.5-flash). */
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
    .select('id, slug, title_en, title_uk, summary_en, summary_uk, category_slug, card_image_url, review_status')
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
      const scene = await sceneBrief(title, summary, cfg);
      const positive = buildPrompt(accent, scene);
      const png = await generateImage(positive, negativePrompt(), cfg, seedFromString(it.slug!));
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

/**
 * Light brand styling wrapped around a story-specific SCENE. The scene is the
 * dominant clause (so each card looks distinct); the constant styling is a thin
 * editorial thread + the category accent — deliberately NOT a heavy "near-black
 * cinematic" preamble, which is what previously homogenised every card.
 */
export function buildPrompt(accent: string, scene: string): string {
  return (
    `Premium editorial illustration for a technology-news cover, in the style of a sophisticated ` +
    `magazine feature. One strong focal subject, clear visual storytelling, tasteful depth of field ` +
    `and confident directional lighting, ${accent} as the signature accent woven through the palette, ` +
    `a refined modern atmosphere with real texture and craft — not flat, not a generic stock render. ` +
    `Leave calm negative space toward the top and bottom for an overlaid headline. ` +
    `No text, no words, no letters, no numbers, no logos, no watermark, no user interface, no frame, no border. ` +
    `Scene: ${scene} Wide 16:9 horizontal composition, edge-to-edge full-bleed.`
  );
}

/** Negative keywords for models that support a negative prompt (Leonardo, FLUX.2). */
export function negativePrompt(): string {
  return (
    `text, words, letters, typography, numbers, caption, watermark, signature, logo, brand mark, ` +
    `UI, interface, buttons, frame, border, margin, collage, split panels, ` +
    `glowing brain, human brain, brain, neural-network mesh, circuit board, generic glowing orb, ` +
    `floating sphere, abstract blob, low quality, blurry, jpeg artifacts, distorted, deformed, ` +
    `extra fingers, extra limbs, cluttered, busy, stock-photo look`
  );
}

const DEFAULT_SCENE =
  'a sleek developer workstation in a dark studio, sharp focus on a mechanical keyboard and ' +
  'softly floating translucent code panels, warm key light';

/**
 * Turn a headline + summary into ONE concrete, on-topic cover scene — a clear
 * focal subject a reader instantly ties to THIS story, with the over-used "AI"
 * clichés explicitly banned so cards stop looking interchangeable. Falls back to
 * a keyword-chosen concrete scene (never a brain) if the model call fails.
 */
export async function sceneBrief(title: string, summary: string, cfg: CardImageConfig): Promise<string> {
  const ctx = [title, summary].filter(Boolean).join('. ').trim();
  if (!ctx) return DEFAULT_SCENE;
  const instruction =
    `You are the art director for a developer-focused technology magazine. Read this news item and ` +
    `describe ONE concrete cover illustration a reader instantly connects to THIS specific story. ` +
    `Name a real, tangible focal subject + setting + action grounded in the actual topic — for example ` +
    `a coding terminal or IDE, a laptop or phone on a desk, a server rack, a data-center corridor, ` +
    `interlocking precision machinery, a robotic arm, an architectural structure, a lock or shield for ` +
    `security, an MRI/scan lightbox for medical imaging, flowing light or stacked coins for funding, a ` +
    `product on a reveal stage for a launch, cooperating figures for agents. Make each story look ` +
    `visually DISTINCT. ` +
    `STRICTLY AVOID these clichés: a glowing brain, a glowing orb or core, a neural-network mesh, a ` +
    `generic circuit board, or a vague abstract "AI" blob. No text, letters, numbers, logos, brand ` +
    `marks or recognisable real faces. ` +
    `Answer with ONE vivid phrase, 18-32 words, concrete nouns, a single focal subject, not a full ` +
    `sentence.\n\nHeadline: "${title}"\nSummary: "${summary}"`;
  const clean = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 320);
  const model = cfg.geminiModel || process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

  // Primary: Gemini. Fallback: OpenRouter (separate billing → survives Gemini
  // free-tier rate limits, e.g. during a backfill). Last resort: a keyword scene.
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
      /* fall through to keyword scene */
    }
  }

  return fallbackScene(ctx);
}

/** Keyword → concrete scene, so even without the model cards vary by topic (never a brain). */
export function fallbackScene(text: string): string {
  const t = text.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => t.includes(w));
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

/** Quality ladder: Gemini image → Cloudflare premium → Cloudflare schnell → Pollinations. */
async function generateImage(
  positive: string,
  negative: string,
  cfg: CardImageConfig,
  seed: number,
): Promise<Buffer | null> {
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
async function generateGemini(prompt: string, cfg: CardImageConfig): Promise<Buffer | null> {
  const model = cfg.geminiImageModel!.trim();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': cfg.geminiApiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '16:9' } },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );
    if (!res.ok) {
      logEvent('warn', 'publish', 'Gemini image gen failed', { status: res.status, model });
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[];
    };
    for (const part of data.candidates?.[0]?.content?.parts ?? []) {
      const b64 = part.inlineData?.data ?? part.inline_data?.data;
      if (b64) return Buffer.from(b64, 'base64');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Cloudflare Workers AI. Premium models (Leonardo, FLUX.2) take native 16:9 +
 * negative prompts + guidance; distilled flux-1-schnell takes only prompt+steps.
 * Tolerates both response shapes: JSON `{result:{image:base64}}` and raw binary.
 */
async function generateCloudflare(
  model: string,
  positive: string,
  negative: string,
  cfg: CardImageConfig,
  seed: number,
): Promise<Buffer | null> {
  const isSchnell = model === SCHNELL_MODEL;
  const body = isSchnell
    ? { prompt: positive, steps: 8 }
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
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
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
