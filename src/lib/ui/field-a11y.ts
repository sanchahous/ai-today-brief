import type { Lang } from '@/lib/site';

/** Join hint, error and caller ids for `aria-describedby`. Empty parts are omitted. */
export function describedBy(
  ids: ReadonlyArray<string | false | null | undefined>,
): string | undefined {
  const value = ids.filter((id): id is string => typeof id === 'string' && id.length > 0).join(' ');
  return value.length > 0 ? value : undefined;
}

/** SearchInput copy. Callers can still override the placeholder and the clear button name. */
export function searchFieldCopy(lang: Lang): { placeholder: string; clearLabel: string } {
  if (lang === 'uk') return { placeholder: 'Пошук…', clearLabel: 'Очистити поле' };
  return { placeholder: 'Search...', clearLabel: 'Clear input' };
}
