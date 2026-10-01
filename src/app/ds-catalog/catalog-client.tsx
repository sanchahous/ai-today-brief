'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { ActionCatalog } from './action-catalog';
import { FeedbackCatalog } from './feedback-catalog';
import { FieldCatalog } from './field-catalog';
import { OverlayCatalog } from './overlay-catalog';
import {
  Accordion,
  Combobox,
  Dialog,
  DropdownMenu,
  Popover,
  Tabs,
  ToastProvider,
  Tooltip,
  useToast,
} from '@/components/ui';

const TOOLS = [
  { value: 'claude-code', label: 'Claude Code', keywords: 'anthropic cli' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'codex', label: 'Codex', keywords: 'openai' },
  { value: 'agents', label: 'Агенти' },
  { value: 'mcp', label: 'MCP', disabled: true },
];

const TRIGGER =
  'bg-surface border-border text-text min-h-[44px] rounded-lg border px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]';

function Section({ title, children }: { title: string; children: ReactNode }) {
  const headingId = `h-${encodeURIComponent(title)}`;
  return (
    <section aria-labelledby={headingId} className="border-border border-t py-8">
      <h2 id={headingId} className="mb-4 font-serif text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={TRIGGER} onClick={() => toast({ message: 'Saved', tone: 'success' })}>
        Success toast
      </button>
      <button type="button" className={TRIGGER} onClick={() => toast({ message: 'Failed to save', tone: 'error' })}>
        Error toast
      </button>
    </div>
  );
}

export function CatalogClient() {
  const [tool, setTool] = useState<string | null>(null);
  const [picked, setPicked] = useState('none');
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogTrigger = useRef<HTMLButtonElement>(null);
  const dialogId = useId();

  return (
    <ToastProvider>
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="font-serif text-3xl">Design system catalog</h1>
        <p className="text-muted mt-2 text-sm">Tokens v2.0.0 · internal, not indexed.</p>

        <Section title="Typography / Типографіка">
          <p className="eyebrow text-accent">In focus / У фокусі</p>
          <p className="eyebrow eyebrow-registry text-muted">Source registry and verification / Реєстр джерел і перевірки</p>
          <p className="font-serif text-4xl">A clearer <em>signal</em></p>
          <div lang="uk">
            <p className="font-serif text-4xl">Чіткіший <em>сигнал</em> з Claude Code — Ґ, Є, І, Ї</p>
          </div>
          <p className="reading-copy mt-4">Reading at 18 px / 1.78. Читання: українська кирилиця та Latin product names.</p>
        </Section>

        <ActionCatalog />
        <FieldCatalog />

        <Section title="Popover">
          <Popover
            ariaLabel="Filter help"
            trigger={({ triggerProps }) => (
              <button type="button" className={TRIGGER} {...triggerProps}>
                Open popover
              </button>
            )}
          >
            <p className="m-0 p-2 text-sm">Popover content</p>
          </Popover>
        </Section>

        <Section title="Dropdown menu">
          <DropdownMenu
            ariaLabel="Share"
            trigger={({ triggerProps }) => (
              <button type="button" className={TRIGGER} {...triggerProps}>
                Share
              </button>
            )}
            items={[
              { id: 'copy', label: 'Copy link', onSelect: () => setPicked('copy') },
              { id: 'x', label: 'Share on X', onSelect: () => setPicked('x') },
              { id: 'off', label: 'Unavailable', disabled: true },
              { id: 'li', label: 'Share on LinkedIn', onSelect: () => setPicked('linkedin') },
            ]}
          />
          <p data-testid="menu-result" className="text-muted mt-3 text-sm">
            {picked}
          </p>
        </Section>

        <Section title="Tooltip">
          <Tooltip content="Copies the article link">
            <button type="button" className={TRIGGER}>
              Hover or focus me
            </button>
          </Tooltip>
        </Section>

        <Section title="Tabs">
          <Tabs
            ariaLabel="Digest sections"
            tabs={[
              { id: 'daily', label: 'Daily', content: 'Daily panel' },
              { id: 'weekly', label: 'Weekly', content: 'Weekly panel' },
              { id: 'soon', label: 'Soon', content: 'Soon panel', disabled: true },
              { id: 'monthly', label: 'Monthly', content: 'Monthly panel' },
            ]}
          />
        </Section>

        <Section title="Accordion">
          <Accordion
            items={[
              { id: 'a', title: 'What is the brief?', content: 'A daily AI digest.' },
              { id: 'b', title: 'How is it ranked?', content: 'By editorial rank.' },
            ]}
          />
        </Section>

        <Section title="Combobox">
          <Combobox label="Tool" options={TOOLS} value={tool} onValueChange={setTool} placeholder="Search tools" />
          <p data-testid="combobox-value" className="text-muted mt-3 text-sm">
            {tool ?? 'none'}
          </p>
        </Section>

        <Section title="Toast">
          <ToastDemo />
        </Section>

        <FeedbackCatalog />

        <OverlayCatalog />

        <Section title="Dialog">
          <button
            ref={dialogTrigger}
            type="button"
            className={TRIGGER}
            aria-haspopup="dialog"
            aria-expanded={dialogOpen}
            aria-controls={dialogId}
            onClick={() => setDialogOpen(true)}
          >
            Open dialog
          </button>
          <Dialog
            id={dialogId}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Subscribe to the brief"
            description="One email a week. Unsubscribe any time."
            closeLabel="Close"
            triggerRef={dialogTrigger}
            backdropTestId="catalog-dialog-backdrop"
            panelTestId="catalog-dialog-panel"
            footer={
              <button type="button" className={TRIGGER} onClick={() => setDialogOpen(false)}>
                Done
              </button>
            }
          >
            <label className="text-sm">
              Email
              <input type="email" className="bg-surface border-border mt-1 block min-h-[44px] w-full rounded-lg border px-3" />
            </label>
          </Dialog>
        </Section>

        <Section title="Popover placement (near viewport bottom)">
          <div className="h-[70vh]" aria-hidden="true" />
          <div className="flex justify-end">
            <Popover
              ariaLabel="Edge popover"
              align="start"
              trigger={({ triggerProps }) => (
                <button type="button" className={TRIGGER} {...triggerProps}>
                  Edge popover
                </button>
              )}
            >
              <p className="m-0 h-40 p-2 text-sm">Flips above and to the left at the viewport edge.</p>
            </Popover>
          </div>
        </Section>
      </main>
    </ToastProvider>
  );
}
