import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = process.env.BACKTEST_INPUT_DIR?.trim() || 'artifacts/visual-routing-backtest';
const KEY = process.env.OPEN_ROUTER_API_KEY?.trim() || '';
const MODEL = process.env.BACKTEST_JUDGE_MODEL?.trim() || 'google/gemini-2.5-flash';

type Variant = 'asset_raw' | 'asset_first';

interface Story {
  id: string;
  title: string;
  context: string;
  mechanism: string;
  consequence: string;
}

interface AssetManifestRow {
  id: string;
  rawPath: string;
  finalPath: string;
}

interface Observation {
  objects: string[];
  actions: string[];
  causal_chain: string;
  outcome: string;
  text_present: boolean;
  text_quality: 'none' | 'clean' | 'gibberish' | 'mixed';
  text_clue: string;
  topic: string;
  ambiguity: string;
}

interface Verdict {
  selected_id: string;
  confidence: number;
  context_pass: boolean;
  mechanism_pass: boolean;
  consequence_pass: boolean;
  instant_pass: boolean;
  why: string;
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
    title:
      'One Stripe Engineer Measured His Own Claude Code Use — and Found Agentic AI Burns 600x More Energy Than a Chat Prompt',
    context: 'Measured coding-agent sessions use far more hidden compute than one chat prompt.',
    mechanism: 'The agent repeatedly re-reads the same large context; re-reads are 96% of tokens.',
    consequence: 'A coding-agent prompt can consume roughly 600 times the energy of one chat exchange.',
  },
  {
    id: 'muse-resume',
    title:
      'Meta Launches Muse Code, a Terminal Agent That Runs Unsupervised for 24 Hours to Rewrite GPU Kernels',
    context: 'An unattended coding agent performs a long GPU-kernel optimization run.',
    mechanism: 'A persistent event log restores the agent to the exact interrupted step after a crash.',
    consequence: 'The run can continue for 24 hours and more than 1,000 tool calls without a human restart.',
  },
  {
    id: 'kitesurf-browser',
    title:
      "Cloudflare's Kitesurf browser strips out everything humans need, leaving only what agents want",
    context: 'A browser engine is rebuilt specifically for AI-agent web automation.',
    mechanism: 'Human-facing layers such as tabs and rich rendering are removed while the automation core remains.',
    consequence: 'The smaller engine needs less CPU and memory, with reduced rendering fidelity as a trade-off.',
  },
  {
    id: 'tutor-restraint',
    title:
      "Allen Institute Releases TutorMoments, and Seven LLMs More Than Double Their 'When to Help' Score Once They Know They're Being Tested",
    context: 'An AI tutor must decide when to help and when to let a learner continue independently.',
    mechanism: 'Evaluation awareness makes the tutor hold back instead of automatically taking over.',
    consequence: 'Measured restraint improves the score from 0.182 to 0.458 and reduces over-assistance.',
  },
];

function assertEnv() {
  if (!KEY) throw new Error('OPEN_ROUTER_API_KEY is required');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseObject(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error(`Invalid JSON: ${cleaned.slice(0, 400)}`);
  }
}

async function callJudge(
  content: Array<Record<string, unknown>>,
  responseFormat: Record<string, unknown>,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${KEY}`,
          'content-type': 'application/json',
          'HTTP-Referer': 'https://aitodaybrief.com',
          'X-Title': 'AI Today Brief asset-first visual backtest',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content }],
          temperature: 0,
          max_tokens: 700,
          response_format: responseFormat,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 700)}`);
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      };
      const raw = data.choices?.[0]?.message?.content;
      const text = Array.isArray(raw)
        ? raw.map((part) => part.text ?? '').join('')
        : typeof raw === 'string'
          ? raw
          : '';
      if (!text) throw new Error('No judge response');
      return parseObject(text);
    } catch (error) {
      lastError = error;
      console.warn(`[asset-judge] attempt ${attempt} failed`, error);
      await sleep(attempt * 2_000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const observationFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'blind_observation',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        objects: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 45 } },
        actions: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 55 } },
        causal_chain: { type: 'string', maxLength: 150 },
        outcome: { type: 'string', maxLength: 100 },
        text_present: { type: 'boolean' },
        text_quality: { type: 'string', enum: ['none', 'clean', 'gibberish', 'mixed'] },
        text_clue: { type: 'string', maxLength: 60 },
        topic: { type: 'string', maxLength: 70 },
        ambiguity: { type: 'string', maxLength: 120 },
      },
      required: [
        'objects',
        'actions',
        'causal_chain',
        'outcome',
        'text_present',
        'text_quality',
        'text_clue',
        'topic',
        'ambiguity',
      ],
    },
  },
};

const verdictFormat = {
  type: 'json_schema',
  json_schema: {
    name: 'visual_verdict',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        selected_id: { type: 'string', enum: stories.map((story) => story.id) },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        context_pass: { type: 'boolean' },
        mechanism_pass: { type: 'boolean' },
        consequence_pass: { type: 'boolean' },
        instant_pass: { type: 'boolean' },
        why: { type: 'string', maxLength: 160 },
      },
      required: [
        'selected_id',
        'confidence',
        'context_pass',
        'mechanism_pass',
        'consequence_pass',
        'instant_pass',
        'why',
      ],
    },
  },
};

async function observe(path: string): Promise<Observation> {
  const image = await sharp(path)
    .resize(640, 360, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  const result = await callJudge(
    [
      {
        type: 'text',
        text:
          'Blind pixel inspection only. Fill the exact schema. Keep arrays short. Do not enumerate repeated text; report one unique clue and classify it as clean, gibberish, mixed, or none. Do not infer company/product names unless explicitly visible.',
      },
      {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` },
      },
    ],
    observationFormat,
  );
  return result as unknown as Observation;
}

async function judge(observation: Observation): Promise<Verdict> {
  const candidates = stories.map((story) => ({
    id: story.id,
    title: story.title,
    context: story.context,
    mechanism: story.mechanism,
    consequence: story.consequence,
  }));
  const result = await callJudge(
    [
      {
        type: 'text',
        text:
          'Use only the blind observation. Select one candidate. Context, mechanism and consequence pass only if visibly supported. Labels may clarify facts but must not rescue pixels that depict a contradictory action. instant_pass requires a coherent context→mechanism→consequence mini-story. OBSERVATION=' +
          JSON.stringify(observation) +
          ' CANDIDATES=' +
          JSON.stringify(candidates),
      },
    ],
    verdictFormat,
  );
  return result as unknown as Verdict;
}

function localPath(manifestPath: string) {
  const name = manifestPath.split('/').pop();
  if (!name) throw new Error(`Invalid path: ${manifestPath}`);
  return join(ROOT, 'images', name);
}

async function evaluate(storyId: string, variant: Variant, path: string): Promise<Evaluation> {
  console.log(`[asset-evaluate] ${storyId}/${variant}`);
  const observation = await observe(path);
  const verdict = await judge(observation);
  const retrievalCorrect = verdict.selected_id === storyId;
  const allSemanticPass = Boolean(
    retrievalCorrect &&
      verdict.context_pass &&
      verdict.mechanism_pass &&
      verdict.consequence_pass &&
      verdict.instant_pass,
  );
  return { storyId, variant, imagePath: path, observation, verdict, retrievalCorrect, allSemanticPass };
}

function rate(rows: Evaluation[], read: (row: Evaluation) => boolean) {
  return rows.length ? rows.filter(read).length / rows.length : 0;
}

function aggregate(evaluations: Evaluation[]) {
  return (['asset_raw', 'asset_first'] as Variant[]).map((variant) => {
    const rows = evaluations.filter((row) => row.variant === variant);
    return {
      variant,
      retrieval_accuracy: rate(rows, (row) => row.retrievalCorrect),
      context_pass_rate: rate(rows, (row) => row.verdict.context_pass),
      mechanism_pass_rate: rate(rows, (row) => row.verdict.mechanism_pass),
      consequence_pass_rate: rate(rows, (row) => row.verdict.consequence_pass),
      instant_pass_rate: rate(rows, (row) => row.verdict.instant_pass),
      all_semantic_gates_rate: rate(rows, (row) => row.allSemanticPass),
      clean_or_no_text_rate: rate(
        rows,
        (row) => !row.observation.text_present || row.observation.text_quality === 'clean',
      ),
    };
  });
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

async function main() {
  assertEnv();
  await mkdir(ROOT, { recursive: true });
  const manifest = JSON.parse(
    await readFile(join(ROOT, 'asset-first-manifest.json'), 'utf8'),
  ) as AssetManifestRow[];
  const evaluations: Evaluation[] = [];
  for (const row of manifest) {
    evaluations.push(await evaluate(row.id, 'asset_raw', localPath(row.rawPath)));
    evaluations.push(await evaluate(row.id, 'asset_first', localPath(row.finalPath)));
  }
  const metrics = aggregate(evaluations);
  await writeFile(join(ROOT, 'asset-first-evaluations.json'), JSON.stringify(evaluations, null, 2));
  await writeFile(join(ROOT, 'asset-first-metrics.json'), JSON.stringify(metrics, null, 2));
  const report = [
    '# Asset-first bounded blind backtest',
    '',
    '| Variant | Retrieval | Context | Mechanism | Consequence | 3-second story | All gates | Clean/no text |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...metrics.map(
      (row) =>
        `| ${row.variant} | ${pct(row.retrieval_accuracy)} | ${pct(row.context_pass_rate)} | ${pct(row.mechanism_pass_rate)} | ${pct(row.consequence_pass_rate)} | ${pct(row.instant_pass_rate)} | ${pct(row.all_semantic_gates_rate)} | ${pct(row.clean_or_no_text_rate)} |`,
    ),
    '',
    '## Per image',
    '',
    '| Story | Variant | Selected | Context | Mechanism | Consequence | 3s | Text |',
    '|---|---|---|---:|---:|---:|---:|---|',
    ...evaluations.map(
      (row) =>
        `| ${row.storyId} | ${row.variant} | ${row.verdict.selected_id} | ${row.verdict.context_pass ? '✓' : '✕'} | ${row.verdict.mechanism_pass ? '✓' : '✕'} | ${row.verdict.consequence_pass ? '✓' : '✕'} | ${row.verdict.instant_pass ? '✓' : '✕'} | ${row.observation.text_quality} |`,
    ),
  ].join('\n');
  await writeFile(join(ROOT, 'ASSET-FIRST-RESULTS.md'), `${report}\n`);
  console.log(report);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
