import React from 'react';
import { useProto } from './ProtoContext';
import { usePageMeta } from './hooks';
import { Breadcrumbs } from './features';
import {
  WEB_VITALS,
  LIGHTHOUSE,
  DB_LOAD,
  DB_TABLES,
  HEALTH,
  DATA_SOURCES,
  type Metric,
  type Status,
} from './dashboardData';
import { GaugeIcon, DatabaseIcon, HeartPulseIcon, BarChartIcon, AlertTriangleIcon } from './icons';

const STATUS_COLOR: Record<Status, string> = {
  good: '#9CD66F',
  warn: '#F4C26B',
  bad: '#FF8FA3',
};

function StatusDot({ status }: { status: Status }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: STATUS_COLOR[status],
        boxShadow: `0 0 0 3px ${STATUS_COLOR[status]}22`,
        flexShrink: 0,
      }}
    />
  );
}

function MetricCard({ m }: { m: Metric }) {
  return (
    <div
      style={{
        padding: '1rem 1.1rem',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem' }}>
        <StatusDot status={m.status} />
        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 600 }}>{m.label}</span>
      </div>
      <p
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '1.5rem',
          fontWeight: 700,
          margin: '0 0 0.2rem',
          color: 'var(--color-text)',
        }}
      >
        {m.value}
      </p>
      <p style={{ fontSize: '0.72rem', color: 'var(--color-faint)', margin: 0 }}>{m.target}</p>
    </div>
  );
}

function SectionHead({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '2.4rem 0 1.1rem' }}>
      <span style={{ color: 'var(--color-accent)', display: 'inline-flex' }}>{icon}</span>
      <h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', margin: 0 }}>{children}</h2>
    </div>
  );
}

const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '0.9rem',
};

export function DashboardPage() {
  const { t, lang } = useProto();
  usePageMeta({ page: 'dashboard', lang, title: t('dashTitle'), description: t('dashLead'), noindex: true });

  return (
    <div className="shell" style={{ padding: '2.5rem 1.5rem 1rem' }}>
      <Breadcrumbs items={[{ label: t('breadcrumbHome'), page: 'home' }, { label: t('footerStatus'), page: 'dashboard' }]} />

      <header style={{ maxWidth: 760, marginBottom: '1.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
          <span style={{ color: 'var(--color-accent)', display: 'inline-flex' }}>
            <GaugeIcon size={22} />
          </span>
          <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', margin: 0 }}>{t('dashTitle')}</h1>
        </div>
        <p style={{ fontSize: '1rem', color: 'var(--color-muted)', lineHeight: 1.6, margin: 0 }}>
          {t('dashLead')}
        </p>
      </header>

      {/* design-only note */}
      <div
        role="note"
        style={{
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'center',
          padding: '0.7rem 1rem',
          marginBottom: '1.5rem',
          borderRadius: 'var(--radius-sm)',
          background: 'color-mix(in srgb, #F4C26B 10%, var(--color-surface))',
          border: '1px solid color-mix(in srgb, #F4C26B 40%, transparent)',
          fontSize: '0.84rem',
          color: 'var(--color-text)',
        }}
      >
        <span aria-hidden="true" style={{ color: '#F4C26B', display: 'inline-flex' }}>
          <AlertTriangleIcon size={16} />
        </span>
        {t('dashNote')}
      </div>

      <SectionHead icon={<GaugeIcon size={18} />}>{t('dashCwv')}</SectionHead>
      <div style={grid}>
        {WEB_VITALS.map((m) => (
          <MetricCard key={m.label} m={m} />
        ))}
      </div>

      <SectionHead icon={<BarChartIcon size={18} />}>{t('dashLighthouse')}</SectionHead>
      <div style={grid}>
        {LIGHTHOUSE.map((m) => (
          <MetricCard key={m.label} m={m} />
        ))}
      </div>

      <SectionHead icon={<DatabaseIcon size={18} />}>{t('dashDbLoad')}</SectionHead>
      <div style={grid}>
        {DB_LOAD.map((m) => (
          <MetricCard key={m.label} m={m} />
        ))}
      </div>
      <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', minWidth: 360 }}>
          <thead>
            <tr>
              <th style={thStyle}>{t('dashDbTables')}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{t('dashRows')}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>size</th>
            </tr>
          </thead>
          <tbody>
            {DB_TABLES.map((tbl) => (
              <tr key={tbl.name}>
                <td style={tdStyle}>
                  <code>{tbl.name}</code>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{tbl.rows}</td>
                <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--color-muted)' }}>{tbl.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHead icon={<HeartPulseIcon size={18} />}>{t('dashHealth')}</SectionHead>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
        {HEALTH.map((h) => (
          <li
            key={h.label.en}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              padding: '0.8rem 1rem',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <StatusDot status={h.status} />
            <span style={{ flex: 1, minWidth: 0, fontSize: '0.9rem' }}>{h.label[lang]}</span>
            <span style={{ fontSize: '0.88rem', color: 'var(--color-muted)', fontWeight: 600 }}>
              {h.value[lang]}
            </span>
          </li>
        ))}
      </ul>

      <SectionHead icon={<DatabaseIcon size={18} />}>{t('dashSources')}</SectionHead>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem', display: 'grid', gap: '0.5rem' }}>
        {DATA_SOURCES.map((d) => (
          <li
            key={d.metric.en}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem 0.8rem',
              alignItems: 'baseline',
              padding: '0.6rem 0',
              borderBottom: '1px solid var(--color-border-soft)',
              fontSize: '0.88rem',
            }}
          >
            <strong style={{ flex: '0 0 160px' }}>{d.metric[lang]}</strong>
            <code style={{ color: 'var(--color-muted)', fontSize: '0.82rem' }}>{d.source}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.7rem',
  borderBottom: '1px solid var(--color-border)',
  color: 'var(--color-faint)',
  fontSize: '0.74rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.7rem',
  borderBottom: '1px solid var(--color-border-soft)',
};
