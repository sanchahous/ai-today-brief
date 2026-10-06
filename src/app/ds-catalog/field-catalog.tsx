'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CategoryGlyph } from '@/components/icons';
import {
  Button, Checkbox, Pill, Radio, RadioGroup, SearchInput, SegmentedControl, Select, Switch, Textarea, TextInput,
} from '@/components/ui';
import { focusFirstInvalid } from '@/components/ui/field';
import type { Lang } from '@/lib/site';

const STATES = ['default', 'focus', 'invalid', 'disabled', 'readOnly'] as const;
type FieldState = (typeof STATES)[number];

const COPY = {
  en: {
    title: 'Fields', lang: 'Language', email: 'Email', emailHint: 'We only use this address for the brief.',
    emailError: 'Enter a valid email address, for example you@example.com.', placeholder: 'you@example.com',
    note: 'Note', noteHint: 'Optional context for the editor.', noteError: 'Add a note before sending.',
    sort: 'Sort', search: 'Search the archive', period: 'Period', today: 'Today', week: '7 days', all: 'All',
    edition: 'Edition language', editionHint: 'One edition per address.', agents: 'Agents & MCP',
    agentsHint: 'Includes long facet names that wrap on a narrow screen.', choiceError: 'Choose at least one facet.',
    analytics: 'Analytics', analyticsHint: 'Anonymous visit statistics.', switchError: 'This choice is required.',
    submit: 'Check fields', input: 'Input', textarea: 'Textarea', select: 'Select', searchTitle: 'Search',
    checkbox: 'Checkbox', radio: 'Radio', segmented: 'Segmented control', switch: 'Switch',
    default: 'Default', focus: 'Focus', invalid: 'Invalid', disabled: 'Disabled', readOnly: 'Read-only',
    newest: 'Newest', oldest: 'Oldest',
  },
  uk: {
    title: 'Поля', lang: 'Мова', email: 'Електронна адреса', emailHint: 'Адреса потрібна лише для брифу.',
    emailError: 'Введіть коректну адресу, наприклад you@example.com.', placeholder: 'you@example.com',
    note: 'Нотатка', noteHint: 'Необов’язковий контекст для редакції.', noteError: 'Додайте нотатку перед надсиланням.',
    sort: 'Сортування', search: 'Пошук в архіві', period: 'Період', today: 'Сьогодні', week: '7 днів', all: 'Усе',
    edition: 'Мова випуску', editionHint: 'Одна мова випуску на адресу.', agents: 'Агенти й MCP',
    agentsHint: 'Довга назва фасету має переноситись на вузькому екрані.', choiceError: 'Оберіть хоча б один фасет.',
    analytics: 'Аналітика', analyticsHint: 'Анонімна статистика відвідувань.', switchError: 'Цей вибір обов’язковий.',
    submit: 'Перевірити поля', input: 'Поле', textarea: 'Текстова область', select: 'Список', searchTitle: 'Пошук',
    checkbox: 'Прапорець', radio: 'Перемикач', segmented: 'Сегменти', switch: 'Вимикач',
    default: 'Звичайне', focus: 'Фокус', invalid: 'Помилка', disabled: 'Вимкнено', readOnly: 'Лише читання',
    newest: 'Найновіші', oldest: 'Найдавніші',
  },
} as const;

function fieldFlags(state: FieldState, error: string) {
  return {
    disabled: state === 'disabled',
    readOnly: state === 'readOnly',
    error: state === 'invalid' ? error : undefined,
    hint: state === 'default' || state === 'invalid' || state === 'focus',
  };
}

function InvalidExample({ copy }: { copy: (typeof COPY)[Lang] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<{ email?: string; note?: string }>({});
  const [focusedId, setFocusedId] = useState('');

  useEffect(() => {
    const form = formRef.current;
    if (!form || (!errors.email && !errors.note)) return;
    focusFirstInvalid(form);
    const active = document.activeElement;
    setFocusedId(active instanceof HTMLElement ? active.id : '');
  }, [errors]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    const note = String(data.get('note') ?? '');
    setErrors({
      email: email.includes('@') ? undefined : copy.emailError,
      note: note.trim() ? undefined : copy.noteError,
    });
  };

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} data-testid="field-invalid-form" className="grid max-w-lg gap-4">
      <TextInput id="field-demo-email" name="email" type="email" label={copy.email} hint={copy.emailHint} error={errors.email} placeholder={copy.placeholder} autoComplete="off" />
      <Textarea id="field-demo-note" name="note" label={copy.note} hint={copy.noteHint} error={errors.note} />
      <Button type="submit" variant="primary">{copy.submit}</Button>
      <p data-testid="field-focused-id" className="text-muted m-0 text-sm">{focusedId}</p>
    </form>
  );
}

export function FieldCatalog() {
  const [lang, setLang] = useState<Lang>('en');
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('claude');
  const [period, setPeriod] = useState('today');
  const [edition, setEdition] = useState('en');
  const [agents, setAgents] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const copy = COPY[lang];
  const sorts = [{ value: 'newest', label: copy.newest }, { value: 'oldest', label: copy.oldest }];
  useEffect(() => { setReady(true); }, []);

  return (
    <section id="field-catalog" data-testid="field-catalog" data-ready={ready ? 'true' : 'false'} lang={lang} aria-labelledby="field-catalog-title" className="border-line border-t py-8">
      <h2 id="field-catalog-title" className="mb-4 font-serif text-xl">{copy.title}</h2>
      <div className="mb-4 flex flex-wrap gap-2">
        <Pill pressed={lang === 'en'} onClick={() => setLang('en')}>EN</Pill>
        <Pill pressed={lang === 'uk'} onClick={() => setLang('uk')}>UK</Pill>
      </div>

      <h3 className="mb-2 text-base font-semibold">{copy.input}</h3>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {STATES.map((state) => {
          const flags = fieldFlags(state, copy.emailError);
          return (
            <TextInput
              key={state}
              id={`field-input-${state}`}
              label={`${copy.email} · ${copy[state]}`}
              hint={flags.hint ? copy.emailHint : undefined}
              error={flags.error}
              disabled={flags.disabled}
              readOnly={flags.readOnly}
              defaultValue={state === 'invalid' ? 'not-an-email' : state === 'readOnly' ? 'reader@example.com' : undefined}
              placeholder={copy.placeholder}
              autoComplete="off"
              data-testid={state === 'focus' ? 'field-focus-sample' : undefined}
            />
          );
        })}
      </div>

      <h3 className="mb-2 text-base font-semibold">{copy.textarea}</h3>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {STATES.map((state) => {
          const flags = fieldFlags(state, copy.noteError);
          return (
            <Textarea
              key={state}
              id={`field-note-${state}`}
              label={`${copy.note} · ${copy[state]}`}
              hint={flags.hint ? copy.noteHint : undefined}
              error={flags.error}
              disabled={flags.disabled}
              readOnly={flags.readOnly}
              defaultValue={state === 'readOnly' ? copy.noteHint : undefined}
            />
          );
        })}
      </div>

      <h3 className="mb-2 text-base font-semibold">{copy.select}</h3>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {STATES.map((state) => {
          const flags = fieldFlags(state, copy.choiceError);
          return (
            <Select
              key={state}
              id={`field-sort-${state}`}
              label={`${copy.sort} · ${copy[state]}`}
              hint={flags.hint ? copy.editionHint : undefined}
              error={flags.error}
              disabled={flags.disabled}
              readOnly={flags.readOnly}
              defaultValue="newest"
              options={sorts}
            />
          );
        })}
      </div>

      <h3 className="mb-2 text-base font-semibold">{copy.searchTitle}</h3>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {STATES.map((state) => {
          const flags = fieldFlags(state, copy.emailError);
          return (
            <SearchInput
              key={state}
              lang={lang}
              id={`field-search-${state}`}
              label={`${copy.search} · ${copy[state]}`}
              hint={flags.hint ? copy.emailHint : undefined}
              error={flags.error}
              disabled={flags.disabled}
              readOnly={flags.readOnly}
              defaultValue={state === 'readOnly' ? 'archive' : undefined}
            />
          );
        })}
        <SearchInput
          lang={lang}
          id="field-search-live"
          label={copy.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery('')}
          data-testid="field-search"
        />
      </div>

      <h3 className="mb-2 text-base font-semibold">{copy.checkbox}</h3>
      <div className="mb-6 grid gap-2">
        <Checkbox
          label={copy.agents}
          hint={copy.agentsHint}
          glyph={<CategoryGlyph icon="agents" size={16} />}
          glyphColor="var(--cat-agents)"
          count={1280}
          lang={lang}
          checked={agents}
          onChange={() => setAgents((value) => !value)}
          data-testid="field-checkbox"
        />
        <Checkbox label={`${copy.agents} · ${copy.invalid}`} error={copy.choiceError} hint={copy.agentsHint} />
        <Checkbox label={`${copy.agents} · ${copy.disabled}`} disabled defaultChecked />
        <Checkbox label={`${copy.agents} · ${copy.readOnly}`} readOnly defaultChecked />
      </div>

      <h3 className="mb-2 text-base font-semibold">{copy.radio}</h3>
      <div className="mb-6 grid gap-4">
        <RadioGroup name="field-edition" label={copy.edition} hint={copy.editionHint}>
          <Radio value="en" checked={edition === 'en'} onChange={() => setEdition('en')} label="English" />
          <Radio value="uk" checked={edition === 'uk'} onChange={() => setEdition('uk')} label="Українська" />
          <Radio value="off" disabled label={copy.disabled} />
        </RadioGroup>
        <RadioGroup name="field-edition-invalid" label={`${copy.edition} · ${copy.invalid}`} error={copy.choiceError} hint={copy.editionHint}>
          <Radio value="en" defaultChecked label="English" />
          <Radio value="uk" label="Українська" />
        </RadioGroup>
        <RadioGroup name="field-edition-disabled" label={`${copy.edition} · ${copy.disabled}`} disabled>
          <Radio value="en" defaultChecked label="English" />
        </RadioGroup>
        <RadioGroup name="field-edition-readonly" label={`${copy.edition} · ${copy.readOnly}`} readOnly>
          <Radio value="en" defaultChecked label="English" />
          <Radio value="uk" label="Українська" />
        </RadioGroup>
      </div>

      <h3 className="mb-2 text-base font-semibold">{copy.segmented}</h3>
      <div className="mb-6 grid gap-4">
        <SegmentedControl
          name="field-period"
          label={copy.period}
          hint={copy.editionHint}
          value={period}
          onValueChange={setPeriod}
          options={[
            { value: 'today', label: copy.today },
            { value: 'week', label: copy.week },
            { value: 'all', label: copy.all, disabled: true },
          ]}
        />
        <SegmentedControl name="field-period-invalid" label={`${copy.period} · ${copy.invalid}`} error={copy.choiceError} hint={copy.editionHint} defaultValue="today" options={[{ value: 'today', label: copy.today }, { value: 'week', label: copy.week }]} />
        <SegmentedControl name="field-period-disabled" label={`${copy.period} · ${copy.disabled}`} disabled defaultValue="today" options={[{ value: 'today', label: copy.today }, { value: 'week', label: copy.week }]} />
        <SegmentedControl name="field-period-readonly" label={`${copy.period} · ${copy.readOnly}`} readOnly defaultValue="today" options={[{ value: 'today', label: copy.today }, { value: 'week', label: copy.week }]} />
      </div>

      <h3 className="mb-2 text-base font-semibold">{copy.switch}</h3>
      <div className="mb-6 grid gap-2">
        <Switch data-testid="field-switch" label={copy.analytics} description={copy.analyticsHint} checked={analytics} onChange={() => setAnalytics((value) => !value)} />
        <Switch label={`${copy.analytics} · ${copy.invalid}`} error={copy.switchError} hint={copy.analyticsHint} />
        <Switch label={`${copy.analytics} · ${copy.disabled}`} disabled defaultChecked />
        <Switch label={`${copy.analytics} · ${copy.readOnly}`} readOnly defaultChecked />
      </div>

      <h3 className="mb-2 text-base font-semibold">{copy.submit}</h3>
      <InvalidExample copy={copy} />
    </section>
  );
}
