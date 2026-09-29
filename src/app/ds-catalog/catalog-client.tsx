'use client';

import { useRef, useState, type ReactNode } from 'react';
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
  return (
    <section aria-labelledby={`h-${title}`} className="border-border border-t py-8">
      <h2 id={`h-${title}`} className="mb-4 font-serif text-xl">
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

  return (
    <ToastProvider>
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="font-serif text-3xl">Design system catalog</h1>
        <p className="text-muted mt-2 text-sm">Tokens v2.0.0 · internal, not indexed.</p>

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

        <Section title="Dialog">
          <button ref={dialogTrigger} type="button" className={TRIGGER} onClick={() => setDialogOpen(true)}>
            Open dialog
          </button>
          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Subscribe to the brief"
            description="One email a week. Unsubscribe any time."
            triggerRef={dialogTrigger}
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
