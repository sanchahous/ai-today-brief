'use client';

import { useState } from 'react';
import { Badge, Button, CategoryBadge, Chip, IconButton, Pill, Tag } from '@/components/ui';
import { CheckIcon } from '@/components/icons';
import type { Lang } from '@/lib/site';
import type { ButtonSize, ButtonVariant } from '@/lib/ui/action-styles';

const COPY = {
  en: { title: 'Actions and selection', normal: 'Ready', disabled: 'Disabled', pending: 'Pending', choose: 'Choose topic', remove: 'Removable topic', submit: 'Submit once', finish: 'Finish request', restore: 'Restore topic', tag: 'Topic link', category: 'Agents & MCP', unknown: 'Other category' },
  uk: { title: 'Дії й вибір', normal: 'Готово', disabled: 'Вимкнено', pending: 'Виконується', choose: 'Обрати тему', remove: 'Тема з видаленням', submit: 'Надіслати один раз', finish: 'Завершити запит', restore: 'Повернути тему', tag: 'Посилання на тему', category: 'Агенти й MCP', unknown: 'Інша категорія' },
};
const VARIANTS: ButtonVariant[] = ['primary', 'outline', 'ghost', 'secondary'];
const SIZES: ButtonSize[] = ['sm', 'md', 'lg'];
const STATES = ['normal', 'disabled', 'pending'] as const;

export function ActionCatalog() {
  const [lang, setLang] = useState<Lang>('en');
  const [pressed, setPressed] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [pending, setPending] = useState(false);
  const [activations, setActivations] = useState(0);
  const [submissions, setSubmissions] = useState(0);
  const [chipClicks, setChipClicks] = useState(0);
  const t = COPY[lang];
  return (
    <section id="action-catalog" data-testid="action-catalog" aria-labelledby="action-catalog-title" className="border-line border-t py-8" lang={lang}>
      <h2 id="action-catalog-title" className="mb-4 font-serif text-xl">{t.title}</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        <Pill pressed={lang === 'en'} onClick={() => setLang('en')}>EN</Pill>
        <Pill pressed={lang === 'uk'} onClick={() => setLang('uk')}>UK</Pill>
      </div>
      {VARIANTS.map((variant) => <div key={variant} className="mb-5">
        <h3 className="mb-2 text-base font-semibold">{variant}</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {SIZES.flatMap((size) => STATES.map((state) => <div key={`${size}-${state}`} className="flex min-w-0 items-center gap-2">
            <Button variant={variant} size={size} disabled={state === 'disabled'} pending={state === 'pending'} onClick={() => setActivations((count) => count + 1)}>
              {size} · {t[state]}
            </Button>
            <IconButton variant={variant} size={size} aria-label={`${variant} ${size} ${t[state]}`} disabled={state === 'disabled'} pending={state === 'pending'} onClick={() => setActivations((count) => count + 1)}>
              <CheckIcon />
            </IconButton>
          </div>))}
        </div>
      </div>)}
      <p data-testid="action-activation-count" className="text-muted text-sm">{activations}</p>
      <form onSubmit={(event) => { event.preventDefault(); if (pending) return; setSubmissions((count) => count + 1); setPending(true); }} className="my-4 flex flex-wrap gap-2">
        <Button type="submit" variant="primary" pending={pending} disabled={false} data-testid="action-pending-button">{t.submit}</Button>
        <Button variant="outline" onClick={() => setPending(false)}>{t.finish}</Button>
        <span data-testid="action-submit-count" className="self-center text-sm">{submissions}</span>
      </form>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill pressed={pressed} onClick={() => setPressed((value) => !value)} data-testid="action-toggle">{t.choose}</Pill>
        <Pill pressed disabled>{t.disabled}</Pill>
        <Pill pressed={false} pending>{t.pending}</Pill>
        {!removed && <Chip lang={lang} label={t.remove} active count={1234} onClick={() => setChipClicks((count) => count + 1)} onRemove={() => setRemoved(true)} />}
        <Chip lang={lang} label={t.disabled} disabled onRemove={() => setRemoved(true)} />
        <Chip lang={lang} label={t.pending} pending onRemove={() => setRemoved(true)} />
        <Chip label="MCP" active={pressed} onClick={() => setPressed((value) => !value)} />
        <Button onClick={() => setRemoved(false)}>{t.restore}</Button>
        <span data-testid="action-chip-select-count" className="text-sm">{chipClicks}</span>
        <Tag href="#action-catalog">{t.tag}</Tag>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(['live', 'new', 'verified', 'partial', 'sponsored', 'format'] as const).map((kind) => <Badge kind={kind} lang={lang} key={kind} />)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(['default', 'plain', 'dot'] as const).map((variant) => <CategoryBadge key={variant} variant={variant} name={t.category} slug="agents-and-mcp" color={null} />)}
        <CategoryBadge name={t.unknown} slug="unknown-category" color={null} />
        <CategoryBadge name={null} slug={null} color={null} />
      </div>
    </section>
  );
}
