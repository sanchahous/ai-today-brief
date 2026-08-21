'use client';

import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import { StatusPill } from '@/components/admin/status-pill';
import {
  cancelConfirmMessage,
  countByKind,
  countSelectedKind,
  filterQueueByKind,
  hiddenWeeklyHint,
  keepVisibleSelection,
  kindFiltersPresent,
  packageKindLabel,
  PACKAGE_KIND_LABELS,
  selectAllLabel,
  selectionKindSummary,
  type QueueKindFilter,
} from '@/lib/social/package-queue';

export type PackageQueueItem = {
  id: string;
  kind: string;
  title: string;
  status: string;
  riskLevel: string;
  kindLabel: string;
  sourceDate: string | null;
  channels: string;
  blockers: number;
  warnings: number;
};

function nextSelection(selected: Set<string>, id: string) {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function cancelIdleLabel(count: number) {
  if (count === 0) return 'Cancel future posts';
  if (count === 1) return 'Cancel 1 package';
  return `Cancel ${count} packages`;
}

function PackageKindFilters({
  filter,
  kinds,
  counts,
  total,
  onChange,
}: {
  filter: QueueKindFilter;
  kinds: ReturnType<typeof kindFiltersPresent>;
  counts: Map<string, number>;
  total: number;
  onChange: (next: QueueKindFilter) => void;
}) {
  const options: Array<{ id: QueueKindFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: total },
    ...kinds.map((kind) => ({
      id: kind,
      label: PACKAGE_KIND_LABELS[kind],
      count: counts.get(kind) ?? 0,
    })),
  ];

  return (
    <div role="group" aria-label="Filter packages by kind" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = filter === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={`min-h-11 rounded-full border px-3 text-sm font-semibold transition ${
              active
                ? 'border-[#47e4d3] bg-[#47e4d3]/15 text-[#47e4d3]'
                : 'border-white/15 text-slate-300 hover:border-white/30 hover:text-white'
            }`}
          >
            {option.label}
            <span className="ml-1.5 text-xs tabular-nums opacity-70">{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PackageQueueList({
  packages,
  cancelAction,
}: {
  packages: PackageQueueItem[];
  cancelAction: (formData: FormData) => Promise<void>;
}) {
  const selectAllId = useId();
  const [filter, setFilter] = useState<QueueKindFilter>('daily_digest');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const kinds = kindFiltersPresent(packages);
  const kindCounts = countByKind(packages);
  const visible = filterQueueByKind(packages, filter);
  const visibleIds = visible.map((item) => item.id);
  const selectedCount = selected.size;
  const allSelected = visible.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visible.length > 0 && selectedCount > 0 && !allSelected;
  const weeklyHint = hiddenWeeklyHint(filter, kindCounts.get('weekly_digest') ?? 0);

  function changeFilter(next: QueueKindFilter) {
    setFilter(next);
    setSelected((current) =>
      keepVisibleSelection(
        current,
        filterQueueByKind(packages, next).map((item) => item.id),
      ),
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (selectedCount === 0) {
      event.preventDefault();
      return;
    }
    const message = cancelConfirmMessage({
      count: selectedCount,
      kindSummary: selectionKindSummary(packages, selected),
      weeklyCount: countSelectedKind(packages, selected, 'weekly_digest'),
    });
    if (!window.confirm(message)) event.preventDefault();
  }

  return (
    <form action={cancelAction} onSubmit={onSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Packages</h2>
        <PackageKindFilters
          filter={filter}
          kinds={kinds}
          counts={kindCounts}
          total={packages.length}
          onChange={changeFilter}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Filter first, then select. Select all only covers the visible kind, so a Daily bulk cancel
        cannot take Weekly with it.
        {weeklyHint}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <label
          htmlFor={selectAllId}
          className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-300"
        >
          <input
            id={selectAllId}
            type="checkbox"
            className="size-5 accent-[#47e4d3]"
            checked={allSelected}
            disabled={visible.length === 0}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={() => {
              setSelected(allSelected ? new Set() : new Set(visibleIds));
            }}
          />
          {selectAllLabel(filter)}
        </label>
        <p className="text-xs text-slate-500" aria-live="polite">
          {selectedCount === 0 ? 'None selected' : `${selectedCount} selected`}
        </p>
        <ActionSubmitButton
          idleLabel={cancelIdleLabel(selectedCount)}
          pendingLabel="Cancelling posts…"
          disabled={selectedCount === 0}
          className="min-h-11 rounded-xl border border-red-400/30 px-4 text-sm font-bold text-red-200"
        />
      </div>

      <div className="mt-4 grid gap-4">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
            No {packageKindLabel(filter).toLowerCase()} packages in this queue. Switch filter to see
            the rest before selecting.
          </div>
        ) : null}
        {visible.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <div
              key={item.id}
              className={`flex items-stretch rounded-2xl border bg-[#151b20] transition ${
                isSelected ? 'border-[#47e4d3]/60' : 'border-white/10 hover:border-[#47e4d3]/50'
              }`}
            >
              <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-start justify-center pt-5 pl-3 sm:pt-6 sm:pl-4">
                <input
                  type="checkbox"
                  name="package_id"
                  value={item.id}
                  checked={isSelected}
                  onChange={() => setSelected((current) => nextSelection(current, item.id))}
                  className="size-5 accent-[#47e4d3]"
                />
                <span className="sr-only">Select {item.title}</span>
              </label>
              <Link href={`/admin/packages/${item.id}`} className="min-w-0 flex-1 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill value={item.riskLevel} />
                  <StatusPill value={item.status} />
                  <span className="ml-auto text-xs text-slate-500">{item.sourceDate}</span>
                </div>
                <h3 className="mt-3 text-lg font-bold text-white">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-400 capitalize">
                  {item.kindLabel} · {item.channels}
                </p>
                <div className="mt-4 flex gap-4 text-xs font-semibold">
                  <span className={item.blockers ? 'text-red-300' : 'text-emerald-300'}>
                    {item.blockers} blockers
                  </span>
                  <span className="text-amber-200">{item.warnings} warnings</span>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </form>
  );
}
