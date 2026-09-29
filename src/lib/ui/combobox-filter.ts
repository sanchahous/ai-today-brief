export interface ComboboxOption {
  value: string;
  label: string;
  /** Extra text matched by search but not shown (aliases, tool ids). */
  keywords?: string;
  disabled?: boolean;
}

/**
 * Case-insensitive; strips accents from Latin letters only ("é" → "e"). Cyrillic marks are
 * distinct letters in Ukrainian ("й" ≠ "и", "ї" ≠ "і") so they are kept.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/([A-Za-z])[̀-ͯ]+/g, '$1')
    .normalize('NFC')
    .toLocaleLowerCase();
}

/** Prefix matches rank above substring matches; original order is kept within a rank. */
export function filterOptions(options: readonly ComboboxOption[], query: string): ComboboxOption[] {
  const q = normalizeText(query.trim());
  if (!q) return [...options];
  const prefix: ComboboxOption[] = [];
  const contains: ComboboxOption[] = [];
  for (const option of options) {
    const label = normalizeText(option.label);
    if (label.startsWith(q)) prefix.push(option);
    else if (label.includes(q) || normalizeText(option.keywords ?? '').includes(q)) contains.push(option);
  }
  return [...prefix, ...contains];
}
