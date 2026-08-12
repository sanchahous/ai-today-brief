import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = process.env.BACKTEST_INPUT_DIR?.trim() || 'artifacts/visual-routing-backtest';
const OPEN_ROUTER_API_KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const MODEL = process.env.BACKTEST_JUDGE_MODEL?.trim() || 'google/gemini-2.5-flash';

type Variant = 'baseline' | 'routed' | 'hybrid';

interface Story {
  id: string;
  shortTitle: string;
  title: string;
  context: string;
  mechanism: string;
  consequence: string;
}

interface ManifestRow {
  storyId: string;
  variant: Variant;
  path: string;
  model: string;
}

interface Observation {
  objects?: string[];
  actions?: string[];
  causal?: string[];
  outcomes?: string[];
  text?: string[];
  topic?: string;
  ambiguity?: string;
  [key: string]: unknown;
}

interface Verdict {
  selected_id?: string;
  confidence?: number;
  context_pass?: boolean;
  mechanism_pass?: boolean;
  consequence_pass?: boolean;
  instant_pass?: boolean;
  why?: string;
  [key: string]: unknown;
}

interface Evaluation {
  storyId: string;
  variant: Variant;
  imagePath: string;
  observation: Observation;
  verdict: Verdict;
  retrievalCorrect: boolean;
  allSemanticPass: boolean;
}

const stories: Story[] = [
  {
    id: 'energy-600x',
    shortTitle: 'Claude Code energy: 600×',
    title:
      'One Stripe Engineer Measured His Own Claude Code Use — and Found Agentic AI Burns 600x More Energy Than a Chat Prompt',
    context: 'Measured agentic coding sessions use far more hidden compute than one chat prompt.',
    mechanism: 'The agent repeatedly re-reads the same large context; re-reads are 96% of tokens.',
    consequence: 'A coding-agent prompt can consume roughly 600 times the energy of one chat exchange.',
  },
  {
    id: 'muse-resume',
    shortTitle: 'Muse Code: crash → resume',
    title:
      'Meta Launches Muse Code, a Terminal Agent That Runs Unsupervised for 24 Hours to Rewrite GPU Kernels',
    context: 'An unattended coding agent performs a long GPU-kernel optimization run.',
    mechanism: 'A persistent event log records actions and restores the agent to the exact interrupted step after a crash.',
    consequence: 'The run can continue for up to 24 hours and more than 1,000 tool calls without a human restart.',
  },
  {
    id: 'kitesurf-browser',
    shortTitle: 'Kitesurf: browser for agents',
    title:
      "Cloudflare's Kitesurf browser strips out everything humans need, leaving only what agents want",
    context: 'A browser engine is rebuilt specifically for AI-agent web automation.',
    mechanism: 'Human-facing browser layers such as tabs and rich visual rendering are removed while the automation core remains.',
    consequence: 'The smaller engine needs less CPU and memory, with reduced rendering fidelity as the trade-off.',
  },
  {
    id: 'tutor-restraint',
    shortTitle: 'TutorMoments: restraint',
    title:
      "Allen Institute Releases TutorMoments, and Seven LLMs More Than Double Their 'When to Help' Score Once They Know They're Being Tested",
    context: 'An AI tutor must decide when to help and when to let a learner continue independently.',
    mechanism: 'An evaluation-aware instruction makes the tutor hold back instead of automatically taking over.',
    consequence: 'Measured restraint improves the score from 0.182 to 0.458 and reduces harmful over-assistance.',
  },
];

function assertEnv() {
  if (!OPEN_ROUTER_API_KEY) throw new Error('OPEN_ROUTER_API_KEY is required');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    }
    throw new Error(`Non-JSON judge response: ${cleaned.slice(0, 500)}`);
  }
}

async function openRouter(content: Array<Record<string, unknown>>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://aitodaybrief.com',
          'X-Title': 'AI Today Brief visual routing backtest',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content }],
          temperature: 0,
          max_tokens: 1_200,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 700)}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      };
      const raw = data.choices?.[0]?.message?.content;
      const text = Array.isArray(raw)
        ? raw.map((part) => part.text ?? '').join('')
        : typeof raw === 'string'
          ? raw
          : '';
      if (!text.trim()) throw new Error('OpenRouter returned no text');
      return extractJson(text);
    } catch (error) {
      lastError = error;
      console.warn(`[judge] attempt ${attempt} failed`, error);
      await sleep(attempt * 2_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function observe(imagePath: string): Promise<Observation> {
  const image = await readFile(imagePath);
  const result = await openRouter([
    {
      type: 'text',
      text:
        'Blind pixel observation. You do not know the headline or prompt. JSON only, compact. Max 5 short items per array. Schema: {"objects":[],"actions":[],"causal":[],"outcomes":[],"text":[],"topic":"","ambiguity":""}. Record only visible evidence. Exact readable text goes in text. Do not infer company/product names unless pixels show them.',
    },
    {
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` },
    },
  ]);
  return result as Observation;
}

async function verdict(observation: Observation): Promise<Verdict> {
  const candidates = stories.map((story) => ({
    id: story.id,
    title: story.title,
    context: story.context,
    mechanism: story.mechanism,
    consequence: story.consequence,
  }));
  const result = await openRouter([
    {
      type: 'text',
      text:
        'Use ONLY the blind observation. Select the best matching candidate, then gate whether its context, mechanism and consequence are visibly supported. Generic topical similarity is not enough. JSON only: {"selected_id":"","confidence":0.0,"context_pass":false,"mechanism_pass":false,"consequence_pass":false,"instant_pass":false,"why":"max 25 words"}. instant_pass requires a coherent context→mechanism→consequence mini-story.\nOBSERVATION=' +
        JSON.stringify(observation) +
        '\nCANDIDATES=' +
        JSON.stringify(candidates),
    },
  ]);
  return result as Verdict;
}

function normalizeManifestPath(row: ManifestRow) {
  const fileName = row.path.split('/').pop();
  if (!fileName) throw new Error(`Invalid manifest path: ${row.path}`);
  return join(ROOT, 'images', fileName);
}

async function evaluate(row: ManifestRow): Promise<Evaluation> {
  const imagePath = normalizeManifestPath(row);
  console.log(`[evaluate] ${row.storyId}/${row.variant}`);
  const observation = await observe(imagePath);
  const result = await verdict(observation);
  const retrievalCorrect = result.selected_id === row.storyId;
  const allSemanticPass = Boolean(
    retrievalCorrect &&
      result.context_pass &&
      result.mechanism_pass &&
      result.consequence_pass &&
      result.instant_pass,
  );
  return {
    storyId: row.storyId,
    variant: row.variant,
    imagePath,
    observation,
    verdict: result,
    retrievalCorrect,
    allSemanticPass,
  };
}

function rate(rows: Evaluation[], read: (row: Evaluation) => boolean) {
  return rows.length ? rows.filter(read).length / rows.length : 0;
}

function summary(evaluations: Evaluation[]) {
  return (['baseline', 'routed', 'hybrid'] as Variant[]).map((variant) => {
    const rows = evaluations.filter((row) => row.variant === variant);
    const avgConfidence =
      rows.reduce(
        (sum, row) =>
          sum + (typeof row.verdict.confidence === 'number' ? row.verdict.confidence : 0),
        0,
      ) / Math.max(1, rows.length);
    return {
      variant,
      images: rows.length,
      retrieval_accuracy: rate(rows, (row) => row.retrievalCorrect),
      avg_confidence: avgConfidence,
      context_pass_rate: rate(rows, (row) => row.verdict.context_pass === true),
      mechanism_pass_rate: rate(rows, (row) => row.verdict.mechanism_pass === true),
      consequence_pass_rate: rate(rows, (row) => row.verdict.consequence_pass === true),
      instant_pass_rate: rate(rows, (row) => row.verdict.instant_pass === true),
      all_semantic_gates_rate: rate(rows, (row) => row.allSemanticPass),
    };
  });
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function xml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function badge(row: Evaluation) {
  return [
    row.retrievalCorrect ? 'ID ✓' : `ID ✕→${row.verdict.selected_id ?? '?'}`,
    row.verdict.context_pass ? 'C✓' : 'C✕',
    row.verdict.mechanism_pass ? 'M✓' : 'M✕',
    row.verdict.consequence_pass ? 'K✓' : 'K✕',
    row.verdict.instant_pass ? '3s✓' : '3s✕',
  ].join('  ');
}

async function makeContactSheet(evaluations: Evaluation[]) {
  const thumbW = 550;
  const thumbH = 309;
  const margin = 28;
  const headerH = 78;
  const footerH = 52;
  const rowH = headerH + thumbH + footerH;
  const width = margin * 4 + thumbW * 3;
  const height = margin + stories.length * rowH;
  const variants: Variant[] = ['baseline', 'routed', 'hybrid'];
  const labels: Record<Variant, string> = {
    baseline: 'A · CURRENT',
    routed: 'B · ROUTED',
    hybrid: 'C · HYBRID',
  };
  const imageLayers: sharp.OverlayOptions[] = [];
  const svg: string[] = [
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`,
    '<rect width="100%" height="100%" fill="#071018"/>',
  ];

  for (const [storyIndex, story] of stories.entries()) {
    const y = margin + storyIndex * rowH;
    svg.push(
      `<text x="${margin}" y="${y + 30}" font-family="DejaVu Sans,Arial" font-size="26" font-weight="800" fill="#F2FBFD">${xml(story.shortTitle)}</text>`,
    );
    for (const [variantIndex, variant] of variants.entries()) {
      const row = evaluations.find(
        (candidate) => candidate.storyId === story.id && candidate.variant === variant,
      );
      if (!row) continue;
      const x = margin + variantIndex * (thumbW + margin);
      const image = await sharp(row.imagePath)
        .resize(thumbW, thumbH, { fit: 'cover' })
        .jpeg({ quality: 88 })
        .toBuffer();
      imageLayers.push({ input: image, left: x, top: y + headerH });
      svg.push(
        `<text x="${x}" y="${y + 64}" font-family="DejaVu Sans,Arial" font-size="18" font-weight="700" fill="#67E8F9">${labels[variant]}</text>`,
        `<rect x="${x}" y="${y + headerH + thumbH + 8}" width="${thumbW}" height="34" rx="8" fill="#0D1B24"/>`,
        `<text x="${x + 10}" y="${y + headerH + thumbH + 31}" font-family="DejaVu Sans,Arial" font-size="16" font-weight="700" fill="#DDF8FC">${xml(badge(row))}</text>`,
      );
    }
  }
  svg.push('</svg>');
  imageLayers.push({ input: Buffer.from(svg.join('')), left: 0, top: 0 });
  const output = await sharp({
    create: { width, height, channels: 3, background: '#071018' },
  })
    .composite(imageLayers)
    .png()
    .toBuffer();
  const path = join(ROOT, 'contact-sheet-evaluated.png');
  await writeFile(path, output);
  return path;
}

async function main() {
  assertEnv();
  await mkdir(ROOT, { recursive: true });
  const manifest = JSON.parse(await readFile(join(ROOT, 'render-manifest.json'), 'utf8')) as ManifestRow[];
  const evaluations: Evaluation[] = [];
  for (const row of manifest) evaluations.push(await evaluate(row));
  const metrics = summary(evaluations);
  const contactSheet = await makeContactSheet(evaluations);
  await writeFile(join(ROOT, 'evaluations-openrouter.json'), JSON.stringify(evaluations, null, 2));
  await writeFile(join(ROOT, 'metrics-openrouter.json'), JSON.stringify(metrics, null, 2));

  const markdown = [
    '# Visual routing backtest — evaluated',
    '',
    'Blind two-stage evaluation: image-only observation, followed by forced-choice retrieval and semantic gates over the observation.',
    '',
    '| Variant | Retrieval | Context | Mechanism | Consequence | 3-second story | All gates |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...metrics.map(
      (row) =>
        `| ${row.variant} | ${pct(row.retrieval_accuracy)} | ${pct(row.context_pass_rate)} | ${pct(row.mechanism_pass_rate)} | ${pct(row.consequence_pass_rate)} | ${pct(row.instant_pass_rate)} | ${pct(row.all_semantic_gates_rate)} |`,
    ),
    '',
    '## Per image',
    '',
    '| Story | Variant | Selected | Confidence | Context | Mechanism | Consequence | 3s |',
    '|---|---|---|---:|---:|---:|---:|---:|',
    ...evaluations.map(
      (row) =>
        `| ${row.storyId} | ${row.variant} | ${row.verdict.selected_id ?? 'unknown'} | ${typeof row.verdict.confidence === 'number' ? row.verdict.confidence.toFixed(2) : ''} | ${row.verdict.context_pass ? '✓' : '✕'} | ${row.verdict.mechanism_pass ? '✓' : '✕'} | ${row.verdict.consequence_pass ? '✓' : '✕'} | ${row.verdict.instant_pass ? '✓' : '✕'} |`,
    ),
    '',
    `Contact sheet: ${contactSheet}`,
    '',
    'Automated judging is secondary to owner review; generated text artifacts and editorial aesthetics must be inspected directly.',
  ].join('\n');
  await writeFile(join(ROOT, 'RESULTS.md'), `${markdown}\n`);
  console.log(markdown);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
