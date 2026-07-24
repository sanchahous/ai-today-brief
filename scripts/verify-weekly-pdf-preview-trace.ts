import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface NextTrace {
  files?: unknown;
}

const tracePath = resolve(
  process.cwd(),
  '.next/server/app/api/internal/weekly/generate/route.js.nft.json',
);
const trace = JSON.parse(readFileSync(tracePath, 'utf8')) as NextTrace;
const files = Array.isArray(trace.files)
  ? trace.files
      .filter((file): file is string => typeof file === 'string')
      .map((file) => file.replaceAll('\\', '/'))
  : [];

const required = [
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  'pdfjs-dist/cmaps/',
  'pdfjs-dist/standard_fonts/',
] as const;

const missing = required.filter(
  (requiredPath) => !files.some((file) => file.includes(requiredPath)),
);
if (missing.length > 0) {
  throw new Error(
    `Weekly PDF preview trace is missing runtime PDF.js files: ${missing.join(', ')}. Run npm run build first.`,
  );
}

console.info(
  `Weekly PDF preview trace verified (${files.filter((file) => file.includes('pdfjs-dist/')).length} PDF.js files).`,
);
