'use client';

import { useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ActionSubmitButton } from '@/components/admin/action-submit-button';
import { StatusPill } from '@/components/admin/status-pill';

export type PackageQueueItem = {
  id: string;
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

function cancelConfirmMessage(count: number) {
  const noun = count === 1 ? 'package' : 'packages';
  return `Cancel future posts in ${count} ${noun}? Posted and currently publishing variants stay live.`;
}

export function PackageQueueList({
  packages,
  cancelAction,
}: {
  packages: PackageQueueItem[];
  cancelAction: (formData: FormData) => Promise<void>;
}) {
  const selectAllId = useId();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectedCount = selected.size;
  const allSelected = packages.length > 0 && selectedCount === packages.length;
  const someSelected = selectedCount > 0 && !allSelected;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (selectedCount === 0) {
      event.preventDefault();
      return;
    }
    if (!window.confirm(cancelConfirmMessage(selectedCount))) {
      event.preventDefault();
    }
  }

  return (
    <form action={cancelAction} onSubmit={onSubmit}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Packages</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={selectAllId}
            className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-300"
          >
            <input
              id={selectAllId}
              type="checkbox"
              className="size-5 accent-[#47e4d3]"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected;
              }}
              onChange={() => {
                setSelected(allSelected ? new Set() : new Set(packages.map((item) => item.id)));
              }}
            />
            Select all
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
      </div>

      <div className="mt-4 grid gap-4">
        {packages.map((item) => {
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
