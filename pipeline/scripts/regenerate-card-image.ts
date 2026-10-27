/**
 * Regenerate one published news-card cover (FLUX + Storage upsert).
 *
 * Usage:
 *   npx tsx --env-file=.env.local pipeline/scripts/regenerate-card-image.ts --slug <item-slug>
 */
import { loadPipelineConfig } from '../config';
import { regenerateCardImageForSlug } from '../card-image';
import { createServiceClient } from '../db';
import { logError, logEvent } from '../log';

function parseSlug(argv: string[]): string {
  const index = argv.indexOf('--slug');
  const slug = index >= 0 ? argv[index + 1]?.trim() : '';
  if (!slug) {
    throw new Error('Pass --slug <brief_items.slug>');
  }
  return slug;
}

async function main(): Promise<void> {
  const slug = parseSlug(process.argv);
  const config = loadPipelineConfig();
  if (!config.cloudflareAccountId || !config.cloudflareApiToken) {
    throw new Error('Cloudflare Workers AI credentials are required for regeneration');
  }
  const db = createServiceClient(config.supabaseUrl, config.supabaseServiceKey);
  const result = await regenerateCardImageForSlug(db, slug, {
    cloudflareAccountId: config.cloudflareAccountId,
    cloudflareApiToken: config.cloudflareApiToken,
    geminiApiKey: config.geminiApiKey,
    geminiImageModel: config.geminiImageModel,
    cloudflareImageModel: config.cloudflareImageModel,
    openRouterApiKey: config.openRouterApiKey,
    db,
  });
  if (!result.ok) {
    logEvent('error', 'publish', 'Card image regeneration failed', { slug, reason: result.reason });
    process.exitCode = 1;
    return;
  }
  logEvent('info', 'publish', 'Card image regenerated', {
    slug,
    url: result.url,
    previousUrl: result.previousUrl,
    sceneSource: result.sceneSource,
    scene: result.scene.slice(0, 160),
  });
}

main().catch((error) => {
  logError('publish', 'Card image regeneration crashed', error);
  process.exit(1);
});
