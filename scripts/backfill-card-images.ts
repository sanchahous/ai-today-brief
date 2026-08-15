/**
 * Backfill brand card images for already-published brief items that lack one.
 * Reuses the pipeline step (Cloudflare FLUX → Pollinations → duotone fallback),
 * so it is free and idempotent — items that already have `card_image_url` are
 * skipped. New items get their image automatically at publish; this fills the
 * historical archive once.
 *
 *   npx tsx scripts/backfill-card-images.ts            # all published briefs
 *   npx tsx scripts/backfill-card-images.ts <brief-slug>  # a single brief
 *   npx tsx scripts/backfill-card-images.ts --reencode-png [--dry-run]
 *     # PNG origins → JPEG, no image-model call (no Cloudflare required)
 */
import { readFileSync } from 'node:fs';
import { createServiceClient } from '../pipeline/db';
import { fillCardImages, reencodeStoredCardOrigins } from '../pipeline/card-image';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

async function main() {
  const db = createServiceClient(
    process.env.SCRAPPER_BASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SCRAPPER_SERVICE_KEY!,
  );
  const cfg = {
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN!,
    geminiApiKey: process.env.GEMINI_API_KEY!,
    geminiImageModel: process.env.GEMINI_IMAGE_MODEL?.trim() || undefined,
    cloudflareImageModel: process.env.CLOUDFLARE_IMAGE_MODEL?.trim() || undefined,
    openRouterApiKey: process.env.OPEN_ROUTER_API_KEY || process.env.OPENROUTER_API_KEY || undefined,
  };
  const force = process.argv.includes('--force');
  const reencodePng = process.argv.includes('--reencode-png');
  const dryRun = process.argv.includes('--dry-run');
  const slug = process.argv.slice(2).find((a) => !a.startsWith('--'));

  if (reencodePng) {
    console.log(`reencoding PNG card origins${dryRun ? ' [dry-run]' : ''}…`);
    const stats = await reencodeStoredCardOrigins(db, { dryRun });
    console.log('DONE', stats);
    return;
  }

  if (!cfg.cloudflareAccountId || !cfg.cloudflareApiToken) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN missing in .env.local');
  }
  let query = db.from('briefs').select('id, slug, date').eq('status', 'published');
  if (slug) query = query.eq('slug', slug);
  const { data: briefs, error } = await query.order('date', { ascending: false });
  if (error) throw new Error(`load briefs failed: ${error.message}`);
  if (!briefs?.length) {
    console.log('no published briefs to backfill');
    return;
  }

  console.log(`backfilling ${briefs.length} brief(s)${force ? ' [FORCE regen]' : ''}…`);
  const total = { generated: 0, skipped: 0, failed: 0 };
  for (const b of briefs) {
    const stats = await fillCardImages(db, b.id, cfg, { force });
    total.generated += stats.generated;
    total.skipped += stats.skipped;
    total.failed += stats.failed;
    if (stats.generated || stats.failed) {
      console.log(`  ${b.slug} (${b.date}):`, stats);
    }
  }
  console.log('DONE', total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
