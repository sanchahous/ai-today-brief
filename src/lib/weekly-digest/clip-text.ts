/** Unicode-aware clip used for meta/OG and public `description`. */
export function clipToMaxChars(value: string, maximum: number): string {
  const chars = [...value.trim()];
  if (chars.length <= maximum) return chars.join('');
  const budget = Math.max(1, maximum - 1);
  let sliced = chars.slice(0, budget).join('');
  const lastSpace = sliced.lastIndexOf(' ');
  if (lastSpace > Math.floor(budget * 0.5)) sliced = sliced.slice(0, lastSpace);
  return `${sliced.trimEnd()}…`;
}
