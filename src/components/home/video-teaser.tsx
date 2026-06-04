import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { PlayIcon } from '@/components/icons';
import { Reveal } from '@/components/reveal';

/** Provisioned weekly-video teaser — the CTA is disabled until the channel ships. */
export function VideoTeaser({ lang }: { lang: Lang }) {
  const t = getStrings(lang).landing;
  return (
    <section className="mx-auto w-full max-w-[1160px] px-6 py-6">
      <Reveal>
        <div
          className="rounded-card border-border relative flex flex-wrap items-center gap-6 overflow-hidden border p-6 sm:p-10"
          style={{
            background:
              'radial-gradient(120% 140% at 100% 0%, rgba(240,192,64,0.16), transparent 55%), var(--surface)',
          }}
        >
          <span
            aria-hidden
            className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full"
            style={{
              color: 'var(--accent)',
              background: 'rgba(240,192,64,0.12)',
              border: '1px solid rgba(240,192,64,0.4)',
            }}
          >
            <PlayIcon size={34} />
          </span>
          <div className="min-w-60 flex-1">
            <p className="text-accent pulse text-xs font-bold tracking-[0.14em] uppercase">
              {t.videoEyebrow}
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl">{t.videoTitle}</h2>
            <p className="text-muted mt-2 max-w-xl text-sm leading-relaxed">{t.videoSubtitle}</p>
          </div>
          <button
            type="button"
            disabled
            className="rounded-pill bg-accent cursor-not-allowed px-5 py-3 text-sm font-semibold text-black opacity-80"
          >
            {t.videoCta}
          </button>
        </div>
      </Reveal>
    </section>
  );
}
