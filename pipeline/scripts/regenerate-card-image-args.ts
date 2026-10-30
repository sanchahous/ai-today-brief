import { readFileSync } from 'node:fs';

function argValue(argv: string[], flag: string): string {
  const index = argv.indexOf(flag);
  return index >= 0 ? (argv[index + 1]?.trim() ?? '') : '';
}

/** Parse `--slug`, `--slugs` and `--slugs-file` into a de-duplicated slug list. */
export function parseSlugs(
  argv: string[],
  readFile: (p: string) => string = (p) => readFileSync(p, 'utf8'),
): string[] {
  const out: string[] = [];
  const single = argValue(argv, '--slug');
  if (single) out.push(single);
  const csv = argValue(argv, '--slugs');
  if (csv) out.push(...csv.split(','));
  const file = argValue(argv, '--slugs-file');
  if (file) {
    for (const line of readFile(file).split(/\r?\n/)) {
      const slug = line.split('|')[0]?.trim() ?? '';
      if (slug && !slug.startsWith('#')) out.push(slug);
    }
  }
  const slugs = [...new Set(out.map((s) => s.trim()).filter(Boolean))];
  if (slugs.length === 0) {
    throw new Error('Pass --slug <slug>, --slugs a,b,c or --slugs-file <path>');
  }
  return slugs;
}

