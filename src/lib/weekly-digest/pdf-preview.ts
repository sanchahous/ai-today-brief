import 'server-only';

// PDF.js intentionally uses a fake worker in Node. Its default fallback is a
// dynamic import of `./pdf.worker.mjs`, which is not visible to Vercel's output
// tracer when `pdfjs-dist` is externalized. Import the worker up front instead:
// it registers `globalThis.pdfjsWorker`, so PDF.js uses that in-process worker
// and never resolves a worker path at request time.
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';

import { pdf as openPdf } from 'pdf-to-img';

export function openWeeklyPdfPreview(bytes: Buffer, scale: number) {
  return openPdf(bytes, { scale });
}
