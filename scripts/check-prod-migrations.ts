/**
 * Fail when a migration already on origin/main is missing from prod.
 * Skips when this machine has no service-role credentials, or when the
 * inventory RPC is not deployed yet (this PR's own migration).
 */
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import {
  findMainMigrationsMissingOnProd,
  migrationFilenameToVersion,
} from '../src/lib/supabase-migration-drift';

const DRIFT_RPC = '20260829120000';

function mainFilenamesFromGit(): string[] | null {
  try {
    const output = execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main', '--', 'supabase/migrations'], {
      encoding: 'utf8',
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.sql'));
  } catch {
    return null;
  }
}

function looksLikeMissingRpc(message: string) {
  return /could not find the function|PGRST202|schema cache/i.test(message);
}

async function main() {
  const url =
    process.env.SCRAPPER_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SCRAPPER_SERVICE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.info('[migrations:check] skip — no service-role credentials');
    return;
  }

  const mainFilenames = mainFilenamesFromGit();
  if (!mainFilenames) {
    console.info('[migrations:check] skip — origin/main is not available');
    return;
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc('list_applied_schema_migrations');
  if (error) {
    const mainHasInventory = mainFilenames.some(
      (filename) => migrationFilenameToVersion(filename) === DRIFT_RPC,
    );
    if (looksLikeMissingRpc(error.message) && !mainHasInventory) {
      console.info(
        '[migrations:check] skip — list_applied_schema_migrations is not on prod yet (apply 20260829120000 after merge)',
      );
      return;
    }
    console.error(`[migrations:check] ${error.message}`);
    process.exit(1);
  }

  const rows = Array.isArray(data) ? data : [];
  const prodVersions = rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const version = (row as { version?: unknown }).version;
    return typeof version === 'string' && version ? [version] : [];
  });
  const missing = findMainMigrationsMissingOnProd({
    mainFilenames,
    prodVersions,
  });
  if (missing.length > 0) {
    console.error('[migrations:check] origin/main migrations missing on prod:');
    for (const version of missing) console.error(`  - ${version}`);
    process.exit(1);
  }
  console.info(
    `[migrations:check] OK — ${prodVersions.length} applied, ${mainFilenames.length} on origin/main`,
  );
}

void main();
