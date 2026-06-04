/**
 * Writes src/lib/database.types.ts from Supabase MCP output (stdin JSON: { "types": "..." }).
 * Usage: node scripts/sync-database-types.mjs < .cursor/tmp-db-types.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const raw = readFileSync(0, 'utf8');
const parsed = JSON.parse(raw);
if (typeof parsed.types !== 'string') {
  console.error('Expected JSON object with string field "types"');
  process.exit(1);
}
writeFileSync('src/lib/database.types.ts', parsed.types, 'utf8');
console.log('Wrote src/lib/database.types.ts');
