/**
 * Hand-pick a story for the brief: research → summarize → draft → Telegram (custom styling).
 *
 *   npx tsx --env-file=.env.local pipeline/scripts/custom-news.ts "NVIDIA Nemotron 3 Ultra"
 *   npx tsx --env-file=.env.local pipeline/scripts/custom-news.ts "Topic" --url https://...
 *   npx tsx --env-file=.env.local pipeline/scripts/custom-news.ts "Topic" --dry-run
 *   npx tsx --env-file=.env.local pipeline/scripts/custom-news.ts "Topic" --no-notify
 */
import { loadPipelineConfig } from '../config';
import { runCustomNews } from '../custom-news';
import { logError } from '../log';

function parseArgs(argv: string[]): { topic: string; url?: string; dryRun: boolean; notify: boolean } {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const positional = argv.filter((a) => !a.startsWith('--'));
  const topic = positional.join(' ').trim();
  const urlIdx = argv.indexOf('--url');
  const url = urlIdx >= 0 ? argv[urlIdx + 1]?.trim() : undefined;
  return {
    topic,
    url: url && url.startsWith('http') ? url : undefined,
    dryRun: flags.has('--dry-run'),
    notify: !flags.has('--no-notify'),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.topic) {
    console.error(
      'Usage: custom-news.ts "<topic title>" [--url https://...] [--dry-run] [--no-notify]',
    );
    process.exit(1);
  }

  const config = loadPipelineConfig(process.env, process.argv);
  const result = await runCustomNews(
    {
      topic: args.topic,
      url: args.url,
      dryRun: args.dryRun || config.dryRun,
      notify: args.notify,
    },
    { config },
  );

  if (!args.dryRun && !config.dryRun) {
    console.log(
      [
        '',
        'Custom story drafted.',
        `brief_id: ${result.briefId}`,
        `edition:  ${result.edition}`,
        `items:    ${result.itemCount} (${result.insertedCount} new)`,
        `telegram: ${result.notified ? 'cards sent (✏️ personal styling)' : 'skipped'}`,
        `source:   ${result.research.url}`,
        '',
        'Review in Telegram → 🚀 to publish.',
      ].join('\n'),
    );
  }
}

main().catch((e) => {
  logError('custom-news', 'Failed', e);
  process.exit(1);
});
