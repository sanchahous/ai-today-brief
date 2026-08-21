import type { PackageKind } from './types';

export type QueueKindFilter = 'all' | PackageKind;

export const PACKAGE_KIND_LABELS: Record<PackageKind, string> = {
  daily_digest: 'Daily',
  top_story: 'Top story',
  weekly_digest: 'Weekly',
  breaking: 'Breaking',
  evergreen: 'Evergreen',
};

export const PACKAGE_KIND_ORDER: PackageKind[] = [
  'daily_digest',
  'top_story',
  'weekly_digest',
  'breaking',
  'evergreen',
];

export function isPackageKind(value: string): value is PackageKind {
  for (const kind of PACKAGE_KIND_ORDER) {
    if (kind === value) return true;
  }
  return false;
}

export function packageKindLabel(kind: string) {
  return isPackageKind(kind) ? PACKAGE_KIND_LABELS[kind] : kind.replaceAll('_', ' ');
}

export function filterQueueByKind<T extends { kind: string }>(
  packages: T[],
  filter: QueueKindFilter,
): T[] {
  if (filter === 'all') return packages;
  return packages.filter((item) => item.kind === filter);
}

const DIGEST_FILTERS: PackageKind[] = ['daily_digest', 'weekly_digest'];

export function kindFiltersPresent(packages: Array<{ kind: string }>): PackageKind[] {
  const present = new Set<string>(DIGEST_FILTERS);
  for (const item of packages) {
    if (isPackageKind(item.kind)) present.add(item.kind);
  }
  return PACKAGE_KIND_ORDER.filter((kind) => present.has(kind));
}

export function countByKind(packages: Array<{ kind: string }>) {
  const counts = new Map<string, number>();
  for (const item of packages) {
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  }
  return counts;
}

export function keepVisibleSelection(
  selected: Iterable<string>,
  visibleIds: Iterable<string>,
): Set<string> {
  const visible = new Set(visibleIds);
  const next = new Set<string>();
  for (const id of selected) {
    if (visible.has(id)) next.add(id);
  }
  return next;
}

export function selectionKindSummary(
  packages: Array<{ id: string; kind: string }>,
  selectedIds: Iterable<string>,
): string {
  const selected = new Set(selectedIds);
  const counts = new Map<string, number>();
  for (const item of packages) {
    if (!selected.has(item.id)) continue;
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const kind of PACKAGE_KIND_ORDER) {
    const count = counts.get(kind);
    if (!count) continue;
    parts.push(`${count} ${PACKAGE_KIND_LABELS[kind].toLowerCase()}`);
  }
  for (const [kind, count] of counts) {
    if (isPackageKind(kind)) continue;
    parts.push(`${count} ${kind.replaceAll('_', ' ')}`);
  }
  return parts.join(', ');
}

export function countSelectedKind(
  packages: Array<{ id: string; kind: string }>,
  selectedIds: Iterable<string>,
  kind: PackageKind,
): number {
  const selected = new Set(selectedIds);
  let count = 0;
  for (const item of packages) {
    if (selected.has(item.id) && item.kind === kind) count += 1;
  }
  return count;
}

export function hiddenWeeklyHint(filter: QueueKindFilter, weeklyCount: number) {
  if (filter === 'all' || filter === 'weekly_digest' || weeklyCount === 0) return '';
  const noun = weeklyCount === 1 ? 'package is' : 'packages are';
  return ` ${weeklyCount} weekly ${noun} hidden.`;
}

export function selectAllLabel(filter: QueueKindFilter) {
  if (filter === 'all') return 'Select all';
  return `Select all ${PACKAGE_KIND_LABELS[filter]}`;
}

export function cancelConfirmMessage(input: {
  count: number;
  kindSummary: string;
  weeklyCount: number;
}) {
  const noun = input.count === 1 ? 'package' : 'packages';
  const kinds = input.kindSummary ? ` (${input.kindSummary})` : '';
  const weekly =
    input.weeklyCount > 0
      ? ` This includes ${input.weeklyCount} weekly digest ${input.weeklyCount === 1 ? 'package' : 'packages'}.`
      : '';
  return `Cancel future posts in ${input.count} ${noun}${kinds}? Posted and currently publishing variants stay live.${weekly}`;
}
