import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT_DIR = process.env.BACKTEST_OUT_DIR?.trim() || 'artifacts/visual-routing-backtest';
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim() || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() || '';
const PRIMARY_IMAGE_MODEL =
  process.env.BACKTEST_IMAGE_MODEL?.trim() || '@cf/black-forest-labs/flux-2-klein-9b';
const VISION_MODEL = process.env.BACKTEST_VISION_MODEL?.trim() || 'gemini-2.5-flash';
const WIDTH = 1280;
const HEIGHT = 720;
const FALLBACK_MODEL = '@cf/black-forest-labs/flux-1-schnell';

interface Story {
  id: string;
  shortTitle: string;
  title: string;
  context: string;
  mechanism: string;
  consequence: string;
  format: 'data_contrast' | 'process_sequence' | 'product_cutaway' | 'human_consequence';
  baselineScene: string;
  routedScene: string;
  overlay: 'energy' | 'resume' | 'browser' | 'tutor';
}

interface RenderRecord {
  storyId: string;
  variant: 'baseline' | 'routed' | 'hybrid';
  path: string;
  prompt: string;
  provider: string;
  model: string;
  sha256: string;
  sourceVariant?: 'routed';
}

interface BlindObservation {
  visible_objects?: string[];
  visible_actions?: string[];
  causal_chain?: string[];
  visible_outcomes?: string[];
  readable_text?: string[];
  likely_topic?: string;
  confidence?: number;
  ambiguities?: string[];
  [key: string]: unknown;
}

interface RetrievalResult {
  selected_id?: string;
  confidence?: number;
  second_choice_id?: string;
  rationale?: string;
  [key: string]: unknown;
}

interface SemanticResult {
  context_pass?: boolean;
  mechanism_pass?: boolean;
  consequence_pass?: boolean;
  instant_comprehension_pass?: boolean;
  unsupported_inference?: string[];
  notes?: string;
  [key: string]: unknown;
}

interface EvaluationRecord {
  storyId: string;
  variant: RenderRecord['variant'];
  imagePath: string;
  observation: BlindObservation;
  retrieval: RetrievalResult;
  semantic: SemanticResult;
  retrievalCorrect: boolean;
  semanticAllPass: boolean;
}

const stories: Story[] = [
  {
    id: 'energy-600x',
    shortTitle: 'Claude Code energy: 600×',
    title:
      'One Stripe Engineer Measured His Own Claude Code Use — and Found Agentic AI Burns 600x More Energy Than a Chat Prompt',
    context:
      'An engineer measured 1,138 Claude Code prompts over eight weeks and found agent sessions process vastly more hidden context than a normal chat exchange.',
    mechanism:
      'Multi-step agent loops repeatedly re-read cached context; those re-reads make up 96% of processed tokens.',
    consequence:
      'A real agentic coding session can use roughly 600 times the energy of a single chat prompt, so unattended runs are a materially different compute decision.',
    format: 'data_contrast',
    baselineScene:
      'A hand inserts a single punched card into a slot, causing a massive steam-driven analytical engine to repeatedly cycle a towering stack of context cards through a reader, its boiler glowing red-hot; one small request triggers a huge loop of repeated reading and heat.',
    routedScene:
      'A wide editorial comparison with one continuous visual field. On the left, one compact chat request passes through a small cool inference unit once and produces one reply. On the right, one coding-agent request enters a much larger loop that visibly feeds the same thick context bundle through the inference unit again and again, building intense waste heat and a dramatically larger energy trail. The repeated context loop, not the final answer, is the dominant mechanism. Keep both paths visually comparable and instantly readable.',
    overlay: 'energy',
  },
  {
    id: 'muse-resume',
    shortTitle: 'Muse Code: crash → resume',
    title:
      'Meta Launches Muse Code, a Terminal Agent That Runs Unsupervised for 24 Hours to Rewrite GPU Kernels',
    context:
      'Meta released Muse Code, an unattended coding agent for long GPU-kernel optimization runs.',
    mechanism:
      'Every action is appended to a replay-exact local event log; after a crash the agent replays the log and resumes at the exact interrupted step.',
    consequence:
      'The agent can continue for more than 1,000 tool calls and up to 24 hours without a human restart, though the evidence is limited to specific Hopper kernel work.',
    format: 'process_sequence',
    baselineScene:
      'A single robotic arm works on a modern GPU module. A thin guide wire extends from its base while it etches the chip, suggesting that after a jolt the wire should return the arm to the interrupted point so work can continue without a human.',
    routedScene:
      'A cinematic three-beat process sequence across one wide frame, using the same robotic precision tool and the same GPU workpiece in every beat. First beat: the unattended tool is cutting one exact circuit path while a physical event tape records each completed step. Middle beat: power fails, the tool stops and lifts away, leaving the cut visibly incomplete at one precise point while the event tape remains intact. Final beat: power returns, the tape feeds backward through a reader and guides the tool directly to that exact interruption point, where the same cut continues. The before, failure, and exact resume must be causally linked and visually unmistakable.',
    overlay: 'resume',
  },
  {
    id: 'kitesurf-browser',
    shortTitle: 'Kitesurf: browser for agents',
    title:
      "Cloudflare's Kitesurf browser strips out everything humans need, leaving only what agents want",
    context:
      'Cloudflare launched Kitesurf, a lightweight browser engine built specifically for AI-agent web automation on Workers.',
    mechanism:
      'It removes human-facing browser layers such as tabs and pixel-perfect rendering while retaining the web-processing core agents need.',
    consequence:
      'The smaller engine uses less CPU and memory and can scale agent automation more cheaply, with a trade-off in real-world rendering fidelity.',
    format: 'product_cutaway',
    baselineScene:
      'A stripped-down browser engine runs on a tiny edge node beside a full-featured browser on a heavy server. The skeletal browser lacks human-facing panels, tabs and rendering layers, while the full browser remains bulky.',
    routedScene:
      'A precise exploded cutaway of two browser stacks in one continuous technology-magazine composition. On the left, a complete human browser is visibly assembled from a tab bar, navigation controls, rich pixel-rendering layers, layout engine, network engine and page core, occupying a large server module. Across the center, the human-facing layers are physically lifted away. On the right, only the compact page-processing core, network engine and automation hooks remain, fitted into a tiny edge-compute module and processing the same page structure faster. The removed layers and the surviving agent-facing core must be physically traceable.',
    overlay: 'browser',
  },
  {
    id: 'tutor-restraint',
    shortTitle: 'TutorMoments: knowing when not to help',
    title:
      "Allen Institute Releases TutorMoments, and Seven LLMs More Than Double Their 'When to Help' Score Once They Know They're Being Tested",
    context:
      'TutorMoments tests whether language-model tutors know when to help and when to let a learner continue independently.',
    mechanism:
      'When models are explicitly told their intervention timing is being evaluated, they hold back instead of automatically taking over the task.',
    consequence:
      'Their score rises from 0.182 to 0.458; restraint protects the learner from over-assistance, though the benchmark is still small.',
    format: 'human_consequence',
    baselineScene:
      "A brass tutoring automaton's arm retracts when a punched evaluation card enters a slot and disengages a clutch gear, leaving a child to continue building a wooden block tower with only a safety hook nearby.",
    routedScene:
      'A human-centered continuous classroom comparison with the same learner, the same unfinished block structure and the same AI tutoring device shown in two adjacent work areas. On the left, the tutor repeatedly reaches across the learner, grabs pieces and rebuilds the structure itself; the learner is passive and the structure remains dependent on the tutor. On the right, a visible evaluation signal causes the tutor arms to fold back while the learner studies, corrects a mistake and completes the next section independently; one safety arm only prevents an imminent collapse. The contrast must communicate over-help versus measured restraint, not helpful robot versus unhelpful robot.',
    overlay: 'tutor',
  },
];

function assertEnv() {
  const missing = [
    !CF_ACCOUNT_ID && 'CLOUDFLARE_ACCOUNT_ID',
    !CF_API_TOKEN && 'CLOUDFLARE_API_TOKEN',
    !GEMINI_API_KEY && 'GEMINI_API_KEY',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Missing required secrets: ${missing.join(', ')}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

function currentStylePrompt(scene: string) {
  return (
    `${scene}. ` +
    'One instantly readable cause-and-effect moment: the story anchor, mechanism, and result must be visually connected, not merely placed beside each other. ' +
    'Editorial concept illustration for a technology magazine cover, photoreal materials, clear silhouette, believable physics, shot on 35mm lens, dramatic available light, shallow depth of field, restrained cool-cyan accent, wide 16:9 edge-to-edge, calm empty top and bottom bands, unmarked blank surfaces only, absolutely no readable text, letters, numbers, logos, captions, UI, or screens, no collage, sharp focus on the subject.'
  );
}

function routedPrompt(story: Story) {
  return (
    `Editorial explanatory illustration for an AI engineering news brief. Visual format: ${story.format}. ` +
    `${story.routedScene} ` +
    `The image must communicate in under three seconds: CONTEXT — ${story.context} ` +
    `MECHANISM — ${story.mechanism} CONSEQUENCE — ${story.consequence} ` +
    'Prioritize factual visual explanation over poetic symbolism. Use a coherent wide 16:9 composition with strong hierarchy, realistic materials, crisp edges and restrained cinematic lighting. Process sequences, product cutaways and causal comparisons are allowed when they are the clearest form. Do not generate words, numbers, logos or brand marks; any approved labels will be composited later. Avoid generic gears, pipes, switchboards, glowing data streams and decorative machinery unless they are literal to the described scene.'
  );
}

async function normalizeImage(bytes: Buffer) {
  return sharp(bytes)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 91, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function readCloudflareImage(res: Response) {
  if (!res.ok) {
    const body = (await res.text()).slice(0, 500);
    throw new Error(`Cloudflare ${res.status}: ${body}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = (await res.json()) as { result?: { image?: string } };
    if (!data.result?.image) throw new Error('Cloudflare JSON response contained no image');
    return Buffer.from(data.result.image, 'base64');
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1024) throw new Error('Cloudflare returned an empty image');
  return bytes;
}

async function generateFlux2(prompt: string, model: string) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', String(WIDTH));
  form.append('height', String(HEIGHT));
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    },
  );
  return readCloudflareImage(res);
}

async function generateSchnell(prompt: string) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${FALLBACK_MODEL}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ prompt, steps: 8 }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  return readCloudflareImage(res);
}

async function renderPrompt(prompt: string): Promise<{ bytes: Buffer; model: string }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const bytes = await generateFlux2(prompt, PRIMARY_IMAGE_MODEL);
      return { bytes: await normalizeImage(bytes), model: PRIMARY_IMAGE_MODEL };
    } catch (error) {
      lastError = error;
      console.warn(`[render] ${PRIMARY_IMAGE_MODEL} attempt ${attempt} failed`, error);
      await sleep(1_500 * attempt);
    }
  }
  console.warn('[render] primary exhausted; using FLUX schnell spillover', lastError);
  const bytes = await generateSchnell(prompt);
  return { bytes: await normalizeImage(bytes), model: FALLBACK_MODEL };
}

function xml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pill(x: number, y: number, width: number, label: string, value?: string) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${value ? 104 : 52}" rx="18" fill="#071018" fill-opacity="0.88" stroke="#67E8F9" stroke-opacity="0.7" stroke-width="2"/>
      <text x="${x + 20}" y="${y + 34}" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="1.4" fill="#E6FAFF">${xml(label)}</text>
      ${value ? `<text x="${x + 20}" y="${y + 86}" font-family="DejaVu Sans, Arial, sans-serif" font-size="48" font-weight="800" fill="#67E8F9">${xml(value)}</text>` : ''}
    </g>`;
}

function overlaySvg(kind: Story['overlay']) {
  const commonStart = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000" flood-opacity="0.55"/></filter></defs>
    <g filter="url(#shadow)">`;
  const commonEnd = '</g></svg>';
  if (kind === 'energy') {
    return `${commonStart}
      ${pill(72, 72, 210, 'CHAT', '1×')}
      ${pill(946, 72, 262, 'AGENT LOOP', '600×')}
      ${pill(430, 618, 420, '96% CONTEXT RE-READS')}
      <path d="M312 126 C530 94 740 94 920 126" fill="none" stroke="#67E8F9" stroke-width="5" stroke-linecap="round"/>
      <path d="M894 105 L928 126 L895 148" fill="none" stroke="#67E8F9" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    ${commonEnd}`;
  }
  if (kind === 'resume') {
    return `${commonStart}
      ${pill(74, 66, 160, 'RUN')}
      ${pill(560, 66, 170, 'CRASH')}
      ${pill(1030, 66, 180, 'RESUME')}
      <path d="M250 92 H530" stroke="#67E8F9" stroke-width="5"/><path d="M500 72 L535 92 L500 112" fill="none" stroke="#67E8F9" stroke-width="5"/>
      <path d="M750 92 H1000" stroke="#67E8F9" stroke-width="5"/><path d="M970 72 L1005 92 L970 112" fill="none" stroke="#67E8F9" stroke-width="5"/>
      ${pill(888, 620, 322, '24H • 1,000+ CALLS')}
    ${commonEnd}`;
  }
  if (kind === 'browser') {
    return `${commonStart}
      ${pill(64, 68, 286, 'FULL BROWSER')}
      ${pill(928, 68, 286, 'AGENT CORE')}
      <path d="M390 96 H884" stroke="#67E8F9" stroke-width="5"/><path d="M854 76 L890 96 L854 116" fill="none" stroke="#67E8F9" stroke-width="5"/>
      ${pill(474, 620, 334, 'LESS CPU + MEMORY')}
    ${commonEnd}`;
  }
  return `${commonStart}
    ${pill(64, 66, 242, 'DEFAULT', '0.182')}
    ${pill(890, 66, 324, 'EVALUATION-AWARE', '0.458')}
    ${pill(390, 620, 500, 'HELP LESS • LET THE LEARNER WORK')}
  ${commonEnd}`;
}

async function applyOverlay(inputPath: string, outputPath: string, kind: Story['overlay']) {
  const image = await readFile(inputPath);
  const output = await sharp(image)
    .composite([{ input: Buffer.from(overlaySvg(kind)), top: 0, left: 0 }])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer();
  await writeFile(outputPath, output);
  return output;
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
    throw new Error(`Gemini returned non-JSON: ${cleaned.slice(0, 300)}`);
  }
}

async function gemini(parts: Array<Record<string, unknown>>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': GEMINI_API_KEY,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json',
              maxOutputTokens: 2_048,
            },
          }),
          signal: AbortSignal.timeout(90_000),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 500)}`);
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('')
        .trim();
      if (!text) throw new Error('Gemini returned no text');
      return extractJson(text);
    } catch (error) {
      lastError = error;
      console.warn(`[gemini] attempt ${attempt} failed`, error);
      await sleep(1_500 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function blindObserve(imagePath: string): Promise<BlindObservation> {
  const bytes = await readFile(imagePath);
  const result = await gemini([
    {
      text:
        'You are a blind visual observer. You are NOT given a headline, source story, generation prompt, filename or intended metaphor. Inspect only the pixels. Return JSON with: visible_objects (array), visible_actions (array), causal_chain (array in visible order), visible_outcomes (array), readable_text (array, exact text when present), likely_topic (short string), confidence (0 to 1), ambiguities (array). Never infer a named company or product unless visible pixels explicitly identify it. Distinguish what is visible from what is merely plausible.',
    },
    { inlineData: { mimeType: 'image/jpeg', data: bytes.toString('base64') } },
  ]);
  return result as BlindObservation;
}

async function retrieveStory(observation: BlindObservation): Promise<RetrievalResult> {
  const headlineBlock = stories.map((story) => `${story.id}: ${story.title}`).join('\n');
  const result = await gemini([
    {
      text:
        'Based ONLY on the blind pixel observation below, choose the single best matching headline from the candidate list. Do not use filenames or outside knowledge. Return JSON: {selected_id, confidence, second_choice_id, rationale}. If the pixels are generic, lower confidence rather than filling missing evidence.\n\nBLIND OBSERVATION:\n' +
        JSON.stringify(observation) +
        '\n\nCANDIDATE HEADLINES:\n' +
        headlineBlock,
    },
  ]);
  return result as RetrievalResult;
}

async function semanticJudge(story: Story, observation: BlindObservation): Promise<SemanticResult> {
  const result = await gemini([
    {
      text:
        'Judge whether a reader could recover the source story from this BLIND pixel observation. The observation was produced without seeing the source. Use only evidence explicitly present in the observation. Return JSON: {context_pass:boolean, mechanism_pass:boolean, consequence_pass:boolean, instant_comprehension_pass:boolean, unsupported_inference:array, notes:string}. Context passes only if the actor/system and change are distinguishable. Mechanism passes only if the causal process is visible. Consequence passes only if the benefit, harm or trade-off is visible. Instant comprehension passes only if context + mechanism + consequence form one readable mini-story.\n\nSOURCE CONTRACT:\n' +
        JSON.stringify({
          context: story.context,
          mechanism: story.mechanism,
          consequence: story.consequence,
        }) +
        '\n\nBLIND OBSERVATION:\n' +
        JSON.stringify(observation),
    },
  ]);
  return result as SemanticResult;
}

async function evaluate(record: RenderRecord): Promise<EvaluationRecord> {
  console.log(`[eval] ${record.storyId}/${record.variant}`);
  const story = stories.find((candidate) => candidate.id === record.storyId)!;
  const observation = await blindObserve(record.path);
  const retrieval = await retrieveStory(observation);
  const semantic = await semanticJudge(story, observation);
  const semanticAllPass = Boolean(
    semantic.context_pass &&
      semantic.mechanism_pass &&
      semantic.consequence_pass &&
      semantic.instant_comprehension_pass,
  );
  return {
    storyId: record.storyId,
    variant: record.variant,
    imagePath: record.path,
    observation,
    retrieval,
    semantic,
    retrievalCorrect: retrieval.selected_id === record.storyId,
    semanticAllPass,
  };
}

function metricSummary(evaluations: EvaluationRecord[]) {
  const variants: RenderRecord['variant'][] = ['baseline', 'routed', 'hybrid'];
  return variants.map((variant) => {
    const rows = evaluations.filter((row) => row.variant === variant);
    const boolRate = (read: (row: EvaluationRecord) => boolean) =>
      rows.length ? rows.filter(read).length / rows.length : 0;
    const confidence =
      rows.reduce(
        (sum, row) => sum + (typeof row.retrieval.confidence === 'number' ? row.retrieval.confidence : 0),
        0,
      ) / Math.max(1, rows.length);
    return {
      variant,
      images: rows.length,
      retrieval_accuracy: boolRate((row) => row.retrievalCorrect),
      avg_retrieval_confidence: confidence,
      context_pass_rate: boolRate((row) => row.semantic.context_pass === true),
      mechanism_pass_rate: boolRate((row) => row.semantic.mechanism_pass === true),
      consequence_pass_rate: boolRate((row) => row.semantic.consequence_pass === true),
      instant_comprehension_rate: boolRate(
        (row) => row.semantic.instant_comprehension_pass === true,
      ),
      all_semantic_gates_rate: boolRate((row) => row.semanticAllPass),
    };
  });
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function evaluationBadge(row: EvaluationRecord) {
  const sem = row.semantic;
  return [
    row.retrievalCorrect ? 'ID ✓' : `ID ✕→${row.retrieval.selected_id ?? '?'}`,
    sem.context_pass ? 'C✓' : 'C✕',
    sem.mechanism_pass ? 'M✓' : 'M✕',
    sem.consequence_pass ? 'K✓' : 'K✕',
  ].join('  ');
}

async function contactSheet(records: RenderRecord[], evaluations: EvaluationRecord[]) {
  const thumbW = 550;
  const thumbH = 309;
  const margin = 28;
  const headerH = 78;
  const rowH = headerH + thumbH + 54;
  const canvasW = margin * 4 + thumbW * 3;
  const canvasH = margin + stories.length * rowH;
  const composites: sharp.OverlayOptions[] = [];
  const textParts: string[] = [
    `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="100%" height="100%" fill="#071018"/>`,
  ];
  const variantOrder: RenderRecord['variant'][] = ['baseline', 'routed', 'hybrid'];
  const variantLabels = { baseline: 'A · CURRENT', routed: 'B · ROUTED', hybrid: 'C · HYBRID' };

  for (const [storyIndex, story] of stories.entries()) {
    const y = margin + storyIndex * rowH;
    textParts.push(
      `<text x="${margin}" y="${y + 30}" font-family="DejaVu Sans, Arial" font-size="26" font-weight="800" fill="#F2FBFD">${xml(story.shortTitle)}</text>`,
    );
    for (const [variantIndex, variant] of variantOrder.entries()) {
      const record = records.find((item) => item.storyId === story.id && item.variant === variant)!;
      const evaluation = evaluations.find(
        (item) => item.storyId === story.id && item.variant === variant,
      )!;
      const x = margin + variantIndex * (thumbW + margin);
      const image = await sharp(record.path)
        .resize(thumbW, thumbH, { fit: 'cover' })
        .jpeg({ quality: 88 })
        .toBuffer();
      composites.push({ input: image, left: x, top: y + headerH });
      textParts.push(
        `<text x="${x}" y="${y + 64}" font-family="DejaVu Sans, Arial" font-size="18" font-weight="700" fill="#67E8F9">${variantLabels[variant]}</text>`,
        `<text x="${x}" y="${y + headerH + thumbH + 31}" font-family="DejaVu Sans, Arial" font-size="17" font-weight="700" fill="#DDF8FC">${xml(evaluationBadge(evaluation))}</text>`,
      );
    }
  }
  textParts.push('</svg>');
  composites.unshift({ input: Buffer.from(textParts.join('')), left: 0, top: 0 });
  const output = await sharp({
    create: { width: canvasW, height: canvasH, channels: 3, background: '#071018' },
  })
    .composite(composites)
    .png()
    .toBuffer();
  const outputPath = join(OUT_DIR, 'contact-sheet.png');
  await writeFile(outputPath, output);
  return outputPath;
}

async function main() {
  assertEnv();
  await mkdir(join(OUT_DIR, 'images'), { recursive: true });
  const renders: RenderRecord[] = [];

  for (const story of stories) {
    for (const variant of ['baseline', 'routed'] as const) {
      const prompt = variant === 'baseline' ? currentStylePrompt(story.baselineScene) : routedPrompt(story);
      console.log(`[render] ${story.id}/${variant}`);
      const generated = await renderPrompt(prompt);
      const relativePath = join('images', `${story.id}-${variant}.jpg`);
      const absolutePath = join(OUT_DIR, relativePath);
      await writeFile(absolutePath, generated.bytes);
      renders.push({
        storyId: story.id,
        variant,
        path: absolutePath,
        prompt,
        provider: 'cloudflare',
        model: generated.model,
        sha256: sha256(generated.bytes),
      });
    }
    const routed = renders.find(
      (record) => record.storyId === story.id && record.variant === 'routed',
    )!;
    const hybridPath = join(OUT_DIR, 'images', `${story.id}-hybrid.jpg`);
    const hybridBytes = await applyOverlay(routed.path, hybridPath, story.overlay);
    renders.push({
      storyId: story.id,
      variant: 'hybrid',
      path: hybridPath,
      prompt: routed.prompt,
      provider: 'cloudflare+sharp',
      model: `${routed.model}+deterministic-overlay`,
      sha256: sha256(hybridBytes),
      sourceVariant: 'routed',
    });
  }

  await writeFile(join(OUT_DIR, 'render-manifest.json'), JSON.stringify(renders, null, 2));

  const evaluations: EvaluationRecord[] = [];
  for (const record of renders) {
    evaluations.push(await evaluate(record));
  }
  const metrics = metricSummary(evaluations);
  const sheet = await contactSheet(renders, evaluations);

  await writeFile(join(OUT_DIR, 'evaluations.json'), JSON.stringify(evaluations, null, 2));
  await writeFile(join(OUT_DIR, 'metrics.json'), JSON.stringify(metrics, null, 2));

  const csvRows = [
    'story_id,variant,retrieval_correct,retrieval_selected,retrieval_confidence,context_pass,mechanism_pass,consequence_pass,instant_comprehension_pass,all_semantic_gates',
    ...evaluations.map((row) =>
      [
        row.storyId,
        row.variant,
        row.retrievalCorrect,
        row.retrieval.selected_id ?? '',
        row.retrieval.confidence ?? '',
        row.semantic.context_pass ?? '',
        row.semantic.mechanism_pass ?? '',
        row.semantic.consequence_pass ?? '',
        row.semantic.instant_comprehension_pass ?? '',
        row.semanticAllPass,
      ]
        .map((value) => JSON.stringify(value))
        .join(','),
    ),
  ];
  await writeFile(join(OUT_DIR, 'evaluations.csv'), `${csvRows.join('\n')}\n`);

  const markdown = [
    '# Visual routing backtest',
    '',
    'Controlled comparison on four difficult weekly-digest stories.',
    '',
    '- **A · Current:** current single-scene physical-metaphor policy.',
    '- **B · Routed:** story-dependent visual format with no generated text.',
    '- **C · Hybrid:** the routed image plus deterministic factual labels/arrows.',
    '- Same Cloudflare image model for A and B; C reuses B pixels.',
    '- Blind observer sees only pixels. A second call chooses among four shuffled headlines. A third call gates context, mechanism and consequence using only the blind observation.',
    '',
    '## Aggregate metrics',
    '',
    '| Variant | Story retrieval | Context | Mechanism | Consequence | Instant comprehension | All semantic gates |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...metrics.map(
      (row) =>
        `| ${row.variant} | ${pct(row.retrieval_accuracy)} | ${pct(row.context_pass_rate)} | ${pct(row.mechanism_pass_rate)} | ${pct(row.consequence_pass_rate)} | ${pct(row.instant_comprehension_rate)} | ${pct(row.all_semantic_gates_rate)} |`,
    ),
    '',
    '## Per-image results',
    '',
    '| Story | Variant | Retrieved | Context | Mechanism | Consequence | Instant |',
    '|---|---|---|---:|---:|---:|---:|',
    ...evaluations.map(
      (row) =>
        `| ${row.storyId} | ${row.variant} | ${row.retrievalCorrect ? 'correct' : row.retrieval.selected_id ?? 'unknown'} | ${row.semantic.context_pass ? '✓' : '✕'} | ${row.semantic.mechanism_pass ? '✓' : '✕'} | ${row.semantic.consequence_pass ? '✓' : '✕'} | ${row.semantic.instant_comprehension_pass ? '✓' : '✕'} |`,
    ),
    '',
    `Contact sheet: ${sheet}`,
    '',
    'The automated result is evidence, not the final editorial verdict. Review the contact sheet at feed-thumbnail size before accepting an algorithm change.',
  ].join('\n');
  await writeFile(join(OUT_DIR, 'README.md'), `${markdown}\n`);

  console.log(markdown);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
