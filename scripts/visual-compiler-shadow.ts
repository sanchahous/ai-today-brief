import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  compileVisualPlan,
  validateVisualPlan,
  type VisualClaim,
  type VisualPlan,
} from '../src/lib/weekly-digest/visual-compiler';

const OUT_DIR =
  process.env.VISUAL_COMPILER_OUT_DIR?.trim() || 'artifacts/visual-compiler-shadow';

interface ShadowStory {
  rank: number;
  headline: string;
  claim: VisualClaim;
}

const stories: ShadowStory[] = [
  {
    rank: 1,
    headline:
      'One Stripe Engineer Measured His Own Claude Code Use — and Found Agentic AI Burns 600x More Energy Than a Chat Prompt',
    claim: {
      storyId: 'energy-600x',
      identity: 'a single chat request beside a long-running coding-agent loop',
      change: 'the agent loop repeatedly rereads the same large context',
      mechanism:
        'completed context blocks visibly cycle back through the compute path on every agent step',
      primaryOutcome:
        'the looping path creates a dramatically larger heat and power footprint than the one-pass path',
      coreClaim:
        'repeated context rereading makes an agentic coding session far more energy intensive than one chat exchange',
      primaryEvidence: 'quantitative_difference',
      outcomeKind: 'harm',
      comparison: {
        left: 'one compact chat request passes through a small compute path once',
        right:
          'one coding-agent session loops the same context blocks through a much larger compute path many times',
      },
      quantitativeFacts: [
        { label: 'CHAT', value: '1×' },
        { label: 'AGENT LOOP', value: '600×' },
        { label: 'CONTEXT RE-READS', value: '96%' },
      ],
      overlayDirectives: [
        { text: 'CHAT 1×', regionId: 'baseline' },
        { text: 'AGENT LOOP 600×', regionId: 'amplified', importance: 'primary' },
        { text: 'CONTEXT RE-READS 96%', regionId: 'amplified' },
      ],
      forbiddenContradictions: [
        'the chat path consumes more power than the agent loop',
        'the agent context passes through compute only once',
      ],
    },
  },
  {
    rank: 2,
    headline:
      'Meta Launches Muse Code, a Terminal Agent That Runs Unsupervised for 24 Hours to Rewrite GPU Kernels',
    claim: {
      storyId: 'muse-resume',
      identity: 'the same autonomous tool arm cutting one precise GPU-kernel groove',
      change: 'an interruption stops the arm before the groove is complete',
      mechanism:
        'a persistent event marker returns the same arm to the exact interrupted coordinate',
      primaryOutcome:
        'the arm resumes the unfinished groove without restarting the completed work',
      coreClaim:
        'a replayable event log lets a long autonomous coding run resume from the exact interruption point',
      primaryEvidence: 'temporal_change',
      outcomeKind: 'benefit',
      states: ['RUN', 'CRASH', 'RESUME'],
      overlayDirectives: [
        { text: 'RUN', regionId: 'state-1' },
        { text: 'CRASH', regionId: 'state-2' },
        { text: 'RESUME', regionId: 'state-3', importance: 'primary' },
      ],
      forbiddenContradictions: [
        'the resumed arm starts a different groove',
        'a human manually restarts the arm',
        'the completed portion of the groove is erased',
      ],
    },
  },
  {
    rank: 3,
    headline:
      "Cloudflare's Kitesurf browser strips out everything humans need, leaving only what agents want",
    claim: {
      storyId: 'kitesurf-browser',
      identity: 'a full browser stack beside a compact agent-facing browser core',
      change: 'human-facing tabs and high-fidelity rendering layers are removed',
      mechanism:
        'the removable outer browser layers separate while the web-execution core stays active',
      primaryOutcome:
        'the remaining core runs inside a visibly smaller compute footprint for agent automation',
      coreClaim:
        'removing human-facing browser layers leaves a smaller browser core optimized for agents',
      primaryEvidence: 'architecture_change',
      outcomeKind: 'tradeoff',
      layers: ['FULL BROWSER', 'HUMAN-FACING LAYERS', 'AGENT CORE'],
      overlayDirectives: [
        { text: 'FULL BROWSER', regionId: 'full-system' },
        { text: 'AGENT CORE', regionId: 'remaining-core', importance: 'primary' },
        { text: 'LESS CPU + MEMORY', regionId: 'remaining-core' },
      ],
      forbiddenContradictions: [
        'the compact core is inactive',
        'the removed layers remain attached',
        'the smaller core has more visual rendering layers than the full browser',
      ],
    },
  },
  {
    rank: 4,
    headline:
      "Developer Pierce Freeman Builds a Zero-Cloud Coding Agent Stack by Pairing Qwen3.6's Dense and MoE Models",
    claim: {
      storyId: 'qwen-local-routing',
      identity: 'one local coding-agent router connected to two distinct local model engines',
      change: 'each task is sent to the local model specialized for that kind of work',
      mechanism:
        'code review branches to the dense model while shell and git tasks branch to the MoE model',
      primaryOutcome:
        'accurate code work and fast system actions complete without either route leaving the local workstation',
      coreClaim:
        'pairing two specialized local models can replace one cloud model for a coding-agent workflow',
      primaryEvidence: 'task_routing',
      outcomeKind: 'benefit',
      routing: {
        source: 'a local task classifier at the center of the coding-agent workflow',
        branches: [
          {
            label: 'DENSE • CODE',
            destination: 'a dense local model engine',
            visibleOutcome: 'precise code review and code edits',
          },
          {
            label: 'MOE • SHELL',
            destination: 'a sparse MoE local model engine',
            visibleOutcome: 'fast git, shell and system actions',
          },
        ],
      },
      overlayDirectives: [
        { text: 'LOCAL ROUTER', regionId: 'route-source' },
        { text: 'DENSE • CODE', regionId: 'route-a', importance: 'primary' },
        { text: 'MOE • SHELL', regionId: 'route-b', importance: 'primary' },
      ],
      forbiddenContradictions: [
        'both task types go to the same model',
        'either route visibly exits to a cloud service',
      ],
    },
  },
  {
    rank: 5,
    headline:
      "Allen Institute Releases TutorMoments, and Seven LLMs More Than Double Their 'When to Help' Score Once They Know They're Being Tested",
    claim: {
      storyId: 'tutor-restraint',
      identity: 'the same student and tutoring assistant in two matched learning situations',
      change:
        'evaluation awareness changes the assistant from constant intervention to deliberate restraint',
      mechanism:
        'the default assistant repeatedly moves the student’s blocks while the evaluated assistant keeps its hands back unless collapse is imminent',
      primaryOutcome:
        'the evaluated student performs the task independently with only minimal safety intervention',
      coreClaim:
        'telling a tutoring model it is being evaluated makes it help less and preserve the learner’s agency',
      primaryEvidence: 'counterfactual_comparison',
      outcomeKind: 'benefit',
      comparison: {
        left: 'default assistant constantly rearranges blocks while the student becomes passive',
        right:
          'evaluation-aware assistant keeps both hands back while the student builds independently',
      },
      quantitativeFacts: [
        { label: 'DEFAULT', value: '0.182' },
        { label: 'EVALUATION', value: '0.458' },
      ],
      overlayDirectives: [
        { text: 'DEFAULT 0.182', regionId: 'left' },
        { text: 'EVALUATION 0.458', regionId: 'right' },
        { text: 'HELP LESS', regionId: 'right', importance: 'primary' },
      ],
      forbiddenContradictions: [
        'the evaluated assistant actively builds the tower',
        'both sides show the same level of intervention',
        'the default student is more independent than the evaluated student',
      ],
    },
  },
  {
    rank: 6,
    headline:
      "Simon Willison's llm-anthropic Plugin Brings Claude 5 and Server-Side Tools to the Command Line",
    claim: {
      storyId: 'anthropic-cli-tools',
      identity: 'one terminal invocation connected to a reasoning model and server-side tool services',
      change: 'a single CLI flag exposes search, fetch, code execution and MCP tools',
      mechanism:
        'the terminal request enters the model, branches into the required server-side tool, then returns the tool result into one live reasoning stream',
      primaryOutcome:
        'the developer receives a completed answer without hand-writing a custom orchestration loop',
      coreClaim:
        'server-side tools collapse manually coded CLI orchestration into one model invocation',
      primaryEvidence: 'task_routing',
      outcomeKind: 'benefit',
      routing: {
        source: 'one terminal request entering the reasoning-model tool router',
        branches: [
          {
            label: 'SEARCH • FETCH',
            destination: 'server-side web research tools',
            visibleOutcome: 'retrieved evidence returns to the reasoning stream',
          },
          {
            label: 'CODE • MCP',
            destination: 'server-side execution and MCP tools',
            visibleOutcome: 'executed results return to the same reasoning stream',
          },
        ],
      },
      overlayDirectives: [
        { text: 'ONE FLAG', regionId: 'route-source' },
        { text: 'SEARCH • FETCH', regionId: 'route-a', importance: 'primary' },
        { text: 'CODE • MCP', regionId: 'route-b', importance: 'primary' },
      ],
      forbiddenContradictions: [
        'the developer manually wires every tool loop',
        'tool outputs never return to the terminal result',
      ],
    },
  },
  {
    rank: 7,
    headline:
      "Codex Desktop's Sub-Agents Built a 3D Game in 52 Minutes — Then Couldn't Spot Their Own Rendering Bugs",
    claim: {
      storyId: 'codex-visual-inspection-gap',
      identity: 'the same sub-agent team, finished 3D game and screenshot inspection system',
      change: 'rapid construction succeeds while visual self-inspection fails',
      mechanism:
        'sub-agents assemble the playable scene quickly, but the screenshot inspector signals success while an obvious missing texture remains in view',
      primaryOutcome:
        'the game is completed quickly but still requires a human visual pass before release',
      coreClaim:
        'agent orchestration can build visual software faster than the same system can reliably inspect it',
      primaryEvidence: 'counterfactual_comparison',
      outcomeKind: 'tradeoff',
      comparison: {
        left: 'multiple sub-agents rapidly assemble a coherent playable 3D scene',
        right:
          'an inspection camera gives a positive signal while a large broken texture remains plainly visible',
      },
      overlayDirectives: [
        { text: 'BUILD • 52 MIN', regionId: 'left', importance: 'primary' },
        { text: 'SELF-CHECK', regionId: 'right' },
        { text: 'BUG MISSED', regionId: 'right', importance: 'primary' },
      ],
      forbiddenContradictions: [
        'the screenshot inspector correctly highlights the rendering bug',
        'the final game has no visible rendering defect',
      ],
    },
  },
];

function markdownEscape(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function seconds(milliseconds: number): string {
  return `${Math.round(milliseconds / 100) / 10}s`;
}

function overlaySummary(plan: VisualPlan): string {
  return plan.overlays
    .map((overlay) => `${overlay.text}@${overlay.regionId ?? 'global'}`)
    .join(' · ');
}

function report(plans: Array<{ story: ShadowStory; plan: VisualPlan }>): string {
  const lines = [
    '# Weekly Visual Compiler shadow plans',
    '',
    'Policy: `weekly-visual-compiler-v0` — headline-paired, one core claim, cinematic assets plus deterministic explanatory structure.',
    '',
    '| # | Story | Core claim | Format | Overlay@region | Assets | Est. cost | Est. time | Plan gate |',
    '|---:|---|---|---|---|---:|---:|---:|---|',
  ];
  for (const { story, plan } of plans) {
    const issues = validateVisualPlan(plan);
    lines.push(
      `| ${story.rank} | ${markdownEscape(story.headline)} | ${markdownEscape(
        plan.claim.coreClaim,
      )} | \`${plan.format}\` | ${markdownEscape(
        overlaySummary(plan) || 'none',
      )} | ${plan.renderUnits.length} | $${plan.execution.estimatedUsd.toFixed(
        3,
      )} | ${seconds(plan.execution.estimatedDurationMs)} | ${
        issues.length ? `FAIL: ${issues.join(', ')}` : 'PASS'
      } |`,
    );
  }
  lines.push('', '## Format distribution', '');
  const counts = new Map<string, number>();
  for (const { plan } of plans) counts.set(plan.format, (counts.get(plan.format) ?? 0) + 1);
  for (const [format, count] of [...counts].sort()) lines.push(`- \`${format}\`: ${count}`);
  lines.push('', '## Budget policy', '');
  lines.push('- Maximum accepted-image budget: `$0.10`.');
  lines.push('- Maximum elapsed time: `60s`.');
  lines.push('- Maximum deterministic overlay groups: `3`.');
  lines.push('- Every overlay is assigned to an explicit semantic region.');
  lines.push('- Generated assets must contain no text, labels, arrows, logos or infographic layout.');
  lines.push('- Pixel-only semantic gate runs before overlays are added.');
  return `${lines.join('\n')}\n`;
}

function prompts(plans: Array<{ story: ShadowStory; plan: VisualPlan }>): string {
  const lines = ['# Visual asset prompts', ''];
  for (const { story, plan } of plans) {
    lines.push(`## ${story.rank}. ${story.headline}`, '');
    lines.push(`Format: \`${plan.format}\`  `);
    lines.push(`Core claim: ${plan.claim.coreClaim}  `);
    lines.push(`Overlays: ${overlaySummary(plan) || 'none'}`, '');
    for (const unit of plan.renderUnits) {
      lines.push(`### ${unit.id} — ${unit.regionId}`, '', '```text', unit.prompt, '```', '');
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const plans = stories.map((story) => ({ story, plan: compileVisualPlan(story.claim) }));
  const invalid = plans.filter(({ plan }) => validateVisualPlan(plan).length > 0);
  if (invalid.length > 0) {
    throw new Error(
      `Visual compiler produced invalid plans: ${invalid
        .map(({ story, plan }) => `${story.rank}:${validateVisualPlan(plan).join(',')}`)
        .join(' | ')}`,
    );
  }

  await mkdir(OUT_DIR, { recursive: true });
  await Promise.all([
    writeFile(
      join(OUT_DIR, 'plans.json'),
      `${JSON.stringify(
        plans.map(({ story, plan }) => ({
          rank: story.rank,
          headline: story.headline,
          plan,
        })),
        null,
        2,
      )}\n`,
    ),
    writeFile(join(OUT_DIR, 'report.md'), report(plans)),
    writeFile(join(OUT_DIR, 'prompts.md'), prompts(plans)),
  ]);

  console.log(report(plans));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
