/**
 * Regenerate published news-card covers (FLUX + Storage upsert).
 *
 * Single item (writes immediately, original behaviour):
 *   npx tsx --env-file=.env.local pipeline/scripts/regenerate-card-image.ts --slug <item-slug>
 *
 * Batch (SAFE by default: dry-run unless --apply is passed):
 *   npx tsx --env-file=.env.local pipeline/scripts/regenerate-card-image.ts \
 *     --slugs-file <file with one slug per line> [--apply]
 *   npx tsx --env-file=.env.local pipeline/scripts/regenerate-card-image.ts \
 *     --slugs a,b,c [--apply]
 *
 * Batch mode never touches Storage or `brief_items` without `--apply`: the dry run only
 * loads each row and reports whether it would be regenerated. Rejected / missing slugs
 * are skipped. Lines starting with `#` and anything after `|` in a slugs-file line are
 * ignored, so `slug|approved` annotations are fine. Pollinations is not part of the
 * provider ladder (see card-image.ts), so a failed generation keeps the previous cover.
 */
import { loadPipelineConfig } from '../config';
import { cardImageProvidersExhausted, regenerateCardImageForSlug } from '../card-image';
import { createServiceClient } from '../db';
import { logError, logEvent } from '../log';
import { parseSlugs } from './regenerate-card-image-args';

async function main(): Promise<void> {
  const argv = process.argv;
  const slugs = parseSlugs(argv);
  const batch = argv.includes('--slugs') || argv.includes('--slugs-file');
  const apply = !batch || argv.includes('--apply');
  const config = loadPipelineConfig();
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);

  if (!apply) {
    const { data, error } = await db
      .from('brief_items')
      .select('slug, review_status, card_image_url')
      .in('slug', slugs);
    if (error) throw new Error(`dry-run load failed: ${error.message}`);
    const bySlug = new Map((data ?? []).map((r) => [r.slug, r]));
    let would = 0;
    for (const slug of slugs) {
      const row = bySlug.get(slug);
      const verdict = !row ? 'NOT_FOUND' : row.review_status === 'rejected' ? 'SKIP_REJECTED' : 'WOULD_REGENERATE';
      if (verdict === 'WOULD_REGENERATE') would++;
      console.log(`[dry-run] ${verdict.padEnd(16)} ${slug}`);
    }
    console.log(`[dry-run] ${slugs.length} slug(s), ${would} would be regenerated. Re-run with --apply to write.`);
    return;
  }

  if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
    throw new Error('Cloudflare Workers AI credentials are required for regeneration');
  }
  const cfg = {
    cloudflareAccountId: config.cloudflareAccountId,
    cloudflareApiToken: config.cloudflareApiToken,
    geminiApiKey: config.geminiApiKey,
    geminiImageModel: config.geminiImageModel,
    cloudflareImageModel: config.cloudflareImageModel,
    openRouterApiKey: config.openRouterApiKey,
    db,
  };
  let failed = 0;
  for (const [index, slug] of slugs.entries()) {
    if (cardImageProvidersExhausted(cfg)) {
      // Cloudflare's daily neuron pool is spent: stop instead of burning scene-director calls.
      const remaining = slugs.slice(index);
      failed += remaining.length;
      logEvent('error', 'publish', 'Card image regeneration stopped: image provider quota exhausted', {
        remaining: remaining.length,
        next_slug: slug,
      });
      break;
    }
    const result = await regenerateCardImageForSlug(db, slug, cfg);
    if (!result.ok) {
      failed++;
      logEvent('error', 'publish', 'Card image regeneration failed', { slug, reason: result.reason });
      continue;
    }
    logEvent('info', 'publish', 'Card image regenerated', {
      slug,
      url: result.url,
      previousUrl: result.previousUrl,
      sceneSource: result.sceneSource,
      scene: result.scene.slice(0, 160),
    });
  }
  logEvent('info', 'publish', 'Card image regeneration finished', {
    total: slugs.length,
    failed,
  });
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  logError('publish', 'Card image regeneration crashed', error);
  process.exit(1);
});
