import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = process.env.BACKTEST_ROOT?.trim() || 'artifacts/visual-routing-backtest';
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim() || '';
const MODEL = process.env.BACKTEST_IMAGE_MODEL?.trim() || '@cf/black-forest-labs/flux-2-klein-9b';
const WIDTH = 1280;
const HEIGHT = 720;

interface AssetCase {
  id: string;
  title: string;
  prompt: string;
  overlay: 'energy' | 'resume' | 'browser' | 'tutor';
}

const cases: AssetCase[] = [
  {
    id: 'energy-600x',
    title: 'Claude Code energy: 600×',
    overlay: 'energy',
    prompt:
      'Create a clean textless editorial scene, not an infographic and not a diagram. Two physical compute paths share one dark studio. On the left, one small cool inference device receives one compact unmarked input tile, processes it once, and emits one compact output tile. On the right, a larger inference device receives one input but a thick loop of many identical unmarked context tiles visibly circles back through the device again and again; the repeated loop glows hot, draws much thicker power cables, and releases visible waste heat. The two paths must be visually comparable and connected as one cause-and-effect scene. Blank unmarked surfaces, no paper writing, no letters, no numbers, no captions, no UI, no callouts, no logos, no border, generous empty space at top and bottom for later labels, wide 16:9, crisp premium technology-magazine photography.',
  },
  {
    id: 'muse-resume',
    title: 'Muse Code: crash → resume',
    overlay: 'resume',
    prompt:
      'Create one wide textless editorial sequence showing three temporal states of the same robotic precision arm and the same GPU workpiece, with no panel captions and no written text. Left: the arm cuts one exact luminous groove while a blank perforated event tape records completed steps. Center: a power interruption stops and lifts the arm, leaving the groove visibly unfinished at one precise point while the intact blank tape remains threaded through a recorder. Right: power returns; the tape passes through a reader and mechanically guides the same arm back to the exact unfinished point, where the groove continues. Preserve subject consistency across all three states. No letters, numbers, labels, UI, logos, callouts or gibberish, blank tape only, clean cinematic workshop, wide 16:9, empty top and bottom bands for later overlays.',
  },
  {
    id: 'kitesurf-browser',
    title: 'Kitesurf: browser for agents',
    overlay: 'browser',
    prompt:
      'Create a clean textless product cutaway, not an infographic and not a labeled diagram. On the left, a large browser-engine chassis has a recognizable blank browser-window silhouette and many physical layers: tab strip, navigation controls, rich pixel-rendering plates, layout engine, network engine and page-processing core. Across the center, the human-facing outer layers are visibly being lifted away as intact blank modules. On the right, only a compact page-processing core, network engine and automation connector remain, fitted into a tiny edge-compute module and processing the same page represented by simple geometric blocks. The removal path and surviving core must be physically traceable. All surfaces blank, no readable screens, no letters, numbers, labels, logos, captions, arrows or callouts, white-to-cool-gray studio, wide 16:9, clear empty space for later deterministic labels.',
  },
  {
    id: 'tutor-restraint',
    title: 'TutorMoments: restraint',
    overlay: 'tutor',
    prompt:
      'Create one continuous textless classroom comparison using the same learner, the same unfinished wooden block structure and the same AI tutoring device on both sides. Left side: several tutor arms reach across the learner, take blocks from the learner’s hands and rebuild the structure themselves; the learner becomes passive and uncertain. Right side: the tutor arms are visibly folded back while the learner notices and corrects a mistake independently; one small safety arm only catches a single toppling block without taking over. Make over-help versus measured restraint instantly readable through posture and action. No blackboard writing, no signs, no letters, numbers, labels, logos, captions, callouts or UI, wide 16:9, premium natural editorial photography, clean empty top and bottom bands for later overlays.',
  },
];

function assertEnv() {
  const missing = [
    !CF_ACCOUNT_ID && 'CLOUDFLARE_ACCOUNT_ID',
    !CF_API_TOKEN && 'CLOUDFLARE_API_TOKEN',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing secrets: ${missing.join(', ')}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readImage(response: Response) {
  if (!response.ok) throw new Error(`Cloudflare ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const data = (await response.json()) as { result?: { image?: string } };
    if (!data.result?.image) throw new Error('No image in Cloudflare JSON');
    return Buffer.from(data.result.image, 'base64');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) throw new Error('Cloudflare returned empty image');
  return bytes;
}

async function render(prompt: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('width', String(WIDTH));
      form.append('height', String(HEIGHT));
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${MODEL}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
          body: form,
          signal: AbortSignal.timeout(120_000),
        },
      );
      const bytes = await readImage(response);
      return sharp(bytes)
        .resize(WIDTH, HEIGHT, { fit: 'cover' })
        .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
        .toBuffer();
    } catch (error) {
      lastError = error;
      console.warn(`[render] attempt ${attempt} failed`, error);
      await sleep(attempt * 1_500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function xml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pill(x: number, y: number, width: number, label: string, value?: string) {
  return `<g><rect x="${x}" y="${y}" width="${width}" height="${value ? 104 : 52}" rx="18" fill="#071018" fill-opacity="0.9" stroke="#67E8F9" stroke-opacity="0.75" stroke-width="2"/><text x="${x + 20}" y="${y + 34}" font-family="DejaVu Sans,Arial" font-size="22" font-weight="700" letter-spacing="1.2" fill="#E6FAFF">${xml(label)}</text>${value ? `<text x="${x + 20}" y="${y + 86}" font-family="DejaVu Sans,Arial" font-size="48" font-weight="800" fill="#67E8F9">${xml(value)}</text>` : ''}</g>`;
}

function overlay(kind: AssetCase['overlay']) {
  const start = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="s"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000" flood-opacity=".55"/></filter></defs><g filter="url(#s)">`;
  const end = '</g></svg>';
  if (kind === 'energy') {
    return `${start}${pill(70, 66, 210, 'CHAT', '1×')}${pill(948, 66, 260, 'AGENT LOOP', '600×')}${pill(430, 620, 420, '96% CONTEXT RE-READS')}<path d="M310 122 C520 90 740 90 920 122" fill="none" stroke="#67E8F9" stroke-width="5"/><path d="M890 102 L925 122 L890 142" fill="none" stroke="#67E8F9" stroke-width="5"/>${end}`;
  }
  if (kind === 'resume') {
    return `${start}${pill(74, 64, 160, 'RUN')}${pill(560, 64, 170, 'CRASH')}${pill(1030, 64, 180, 'RESUME')}<path d="M250 90 H530 M750 90 H1000" stroke="#67E8F9" stroke-width="5"/><path d="M500 70 L535 90 L500 110 M970 70 L1005 90 L970 110" fill="none" stroke="#67E8F9" stroke-width="5"/>${pill(888, 620, 322, '24H • 1,000+ CALLS')}${end}`;
  }
  if (kind === 'browser') {
    return `${start}${pill(64, 66, 286, 'FULL BROWSER')}${pill(928, 66, 286, 'AGENT CORE')}<path d="M390 94 H884" stroke="#67E8F9" stroke-width="5"/><path d="M854 74 L890 94 L854 114" fill="none" stroke="#67E8F9" stroke-width="5"/>${pill(474, 620, 334, 'LESS CPU + MEMORY')}${end}`;
  }
  return `${start}${pill(64, 64, 242, 'DEFAULT', '0.182')}${pill(890, 64, 324, 'EVALUATION-AWARE', '0.458')}${pill(390, 620, 500, 'HELP LESS • LET THE LEARNER WORK')}${end}`;
}

async function composite(bytes: Buffer, kind: AssetCase['overlay']) {
  return sharp(bytes)
    .composite([{ input: Buffer.from(overlay(kind)), left: 0, top: 0 }])
    .jpeg({ quality: 93, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function sheet() {
  const thumbW = 800;
  const thumbH = 450;
  const margin = 28;
  const header = 66;
  const rowH = header + thumbH + 26;
  const width = margin * 3 + thumbW * 2;
  const height = margin + rowH * cases.length;
  const layers: sharp.OverlayOptions[] = [];
  const svg = [`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#071018"/>`];
  for (const [index, item] of cases.entries()) {
    const y = margin + index * rowH;
    svg.push(`<text x="${margin}" y="${y + 30}" font-family="DejaVu Sans,Arial" font-size="26" font-weight="800" fill="#F2FBFD">${xml(item.title)}</text>`);
    for (const [column, suffix] of ['asset-raw', 'asset-first'].entries()) {
      const x = margin + column * (thumbW + margin);
      const bytes = await sharp(join(ROOT, 'images', `${item.id}-${suffix}.jpg`))
        .resize(thumbW, thumbH, { fit: 'cover' })
        .jpeg({ quality: 88 })
        .toBuffer();
      layers.push({ input: bytes, left: x, top: y + header });
      svg.push(`<text x="${x}" y="${y + 58}" font-family="DejaVu Sans,Arial" font-size="18" font-weight="700" fill="#67E8F9">${column === 0 ? 'D0 · CLEAN ASSET' : 'D · ASSET-FIRST HYBRID'}</text>`);
    }
  }
  svg.push('</svg>');
  layers.push({ input: Buffer.from(svg.join('')), left: 0, top: 0 });
  const output = await sharp({ create: { width, height, channels: 3, background: '#071018' } })
    .composite(layers)
    .png()
    .toBuffer();
  await writeFile(join(ROOT, 'contact-sheet-asset-first.png'), output);
}

async function main() {
  assertEnv();
  await mkdir(join(ROOT, 'images'), { recursive: true });
  const manifest: Array<Record<string, unknown>> = [];
  for (const item of cases) {
    console.log(`[asset-first] ${item.id}`);
    const raw = await render(item.prompt);
    const final = await composite(raw, item.overlay);
    const rawPath = join(ROOT, 'images', `${item.id}-asset-raw.jpg`);
    const finalPath = join(ROOT, 'images', `${item.id}-asset-first.jpg`);
    await writeFile(rawPath, raw);
    await writeFile(finalPath, final);
    manifest.push({ id: item.id, prompt: item.prompt, model: MODEL, rawPath, finalPath, rawSha256: sha256(raw), finalSha256: sha256(final) });
  }
  await writeFile(join(ROOT, 'asset-first-manifest.json'), JSON.stringify(manifest, null, 2));
  await sheet();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
