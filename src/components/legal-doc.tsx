import { LEGAL_DOCS, type LegalKey } from '@/lib/legal';
import { type Lang } from '@/lib/site';
import { getStrings } from '@/lib/i18n';

export function LegalDocView({ docKey, lang }: { docKey: LegalKey; lang: Lang }) {
  const doc = LEGAL_DOCS[docKey];
  const t = getStrings(lang);
  const updated = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${doc.updated}T00:00:00`));

  return (
    <div className="mx-auto w-full max-w-[760px] flex-1 px-6 py-12">
      <h1 className="text-3xl sm:text-4xl">{doc.title[lang]}</h1>
      <p className="text-faint mt-2 text-sm">
        {t.lastUpdated}: {updated}
      </p>
      <p className="mt-6 leading-relaxed">{doc.intro[lang]}</p>
      <div className="mt-8 space-y-8">
        {doc.sections.map((s) => (
          <section key={s.heading.en}>
            <h2 className="text-xl">{s.heading[lang]}</h2>
            <div className="mt-2 space-y-3 leading-relaxed">
              {s.body.map((b, i) => (
                <p key={i} className="text-muted">
                  {b[lang]}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
