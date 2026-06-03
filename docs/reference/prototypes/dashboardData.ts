/**
 * Mock data for the live-status dashboard prototype (design-only). The values
 * are representative; `DATA_SOURCES` documents where each metric would actually
 * come from once wired. This is NOT the GA4 product analytics — it's an
 * ops/health surface (PageSpeed, DB load, scraper + newsletter health).
 */
import type { Lang } from './data';

type Bi = Record<Lang, string>;
export type Status = 'good' | 'warn' | 'bad';

export interface Metric {
  label: string;
  value: string;
  target: string;
  status: Status;
}

/** Core Web Vitals against the prototype's budgets (see ANALYTICS.md). */
export const WEB_VITALS: Metric[] = [
  { label: 'LCP', value: '1.8 s', target: '≤ 2.0 s', status: 'good' },
  { label: 'INP', value: '120 ms', target: '≤ 200 ms', status: 'good' },
  { label: 'CLS', value: '0.03', target: '≤ 0.05', status: 'good' },
  { label: 'FCP', value: '1.3 s', target: '≤ 1.5 s', status: 'good' },
  { label: 'TTFB', value: '0.7 s', target: '≤ 0.8 s', status: 'warn' },
];

/** Lighthouse (mobile) category scores. */
export const LIGHTHOUSE: Metric[] = [
  { label: 'Performance', value: '96', target: '≥ 90', status: 'good' },
  { label: 'Accessibility', value: '98', target: '≥ 95', status: 'good' },
  { label: 'Best Practices', value: '100', target: '≥ 95', status: 'good' },
  { label: 'SEO', value: '100', target: '100', status: 'good' },
];

export interface DbTable {
  name: string;
  rows: string;
  size: string;
}

/** Mirrors the live Supabase schema row counts from the handoff. */
export const DB_TABLES: DbTable[] = [
  { name: 'articles', rows: '649', size: '2.1 MB' },
  { name: 'brief_items', rows: '60', size: '480 kB' },
  { name: 'pipeline_runs', rows: '67', size: '64 kB' },
  { name: 'concepts', rows: '26', size: '24 kB' },
  { name: 'categories', rows: '9', size: '16 kB' },
  { name: 'briefs', rows: '6', size: '16 kB' },
  { name: 'subscribers', rows: '0', size: '— (new)' },
];

export const DB_LOAD: Metric[] = [
  { label: 'connections', value: '4 / 60', target: '< 50', status: 'good' },
  { label: 'slow queries (24h)', value: '0', target: '0', status: 'good' },
  { label: 'database size', value: '14 MB', target: '< 8 GB', status: 'good' },
  { label: 'cache hit rate', value: '99.2%', target: '> 98%', status: 'good' },
];

export interface HealthItem {
  label: Bi;
  value: Bi;
  status: Status;
}

export const HEALTH: HealthItem[] = [
  {
    label: { uk: 'Uptime (30 днів)', en: 'Uptime (30 days)' },
    value: { uk: '99.98%', en: '99.98%' },
    status: 'good',
  },
  {
    label: { uk: 'Останній запуск пайплайна', en: 'Last pipeline run' },
    value: { uk: 'Сьогодні, 06:00 · успіх', en: 'Today, 06:00 · success' },
    status: 'good',
  },
  {
    label: { uk: 'Помилки скрапера (24г)', en: 'Scraper errors (24h)' },
    value: { uk: '0', en: '0' },
    status: 'good',
  },
  {
    label: { uk: 'Остання розсилка', en: 'Last newsletter send' },
    value: { uk: '— (фаза 1.5)', en: '— (phase 1.5)' },
    status: 'warn',
  },
];

export interface DataSource {
  metric: Bi;
  source: string;
}

/** Where each block of the dashboard would get its real data. */
export const DATA_SOURCES: DataSource[] = [
  {
    metric: { uk: 'Core Web Vitals', en: 'Core Web Vitals' },
    source: 'PageSpeed Insights API + Chrome UX Report (CrUX) + web-vitals RUM',
  },
  {
    metric: { uk: 'Lighthouse', en: 'Lighthouse' },
    source: 'Lighthouse CI on each deploy',
  },
  {
    metric: { uk: 'Навантаження БД', en: 'Database load' },
    source: 'Supabase Platform API + pg_stat_activity / pg_stat_statements',
  },
  {
    metric: { uk: 'Розміри таблиць', en: 'Table sizes' },
    source: 'Supabase / pg_class (relation sizes)',
  },
  {
    metric: { uk: 'Uptime', en: 'Uptime' },
    source: 'External monitor (UptimeRobot / Better Uptime)',
  },
  {
    metric: { uk: 'Пайплайн і скрапер', en: 'Pipeline & scraper' },
    source: 'pipeline_runs table (Supabase)',
  },
  {
    metric: { uk: 'Розсилки', en: 'Newsletter sends' },
    source: 'Beehiiv API + newsletter_sends table',
  },
];
