import { LEGAL_DOCS, type LegalKey } from '@/lib/legal';
import { type Lang } from '@/lib/site';
import { PolicyPageShell } from '@/components/trust-page-shell';

export function LegalDocView({ docKey, lang }: { docKey: LegalKey; lang: Lang }) {
  const doc = LEGAL_DOCS[docKey];
  const sections = doc.sections.map((section, index) => ({
    id: `policy-section-${index + 1}`,
    title: section.heading[lang],
  }));

  return (
    <PolicyPageShell
      lang={lang}
      policyKey={docKey}
      title={doc.title[lang]}
      intro={doc.intro[lang]}
      updated={doc.updated}
      sections={sections}
    >
      {doc.sections.map((s, index) => (
        <section key={s.heading.en} id={sections[index].id} className="scroll-mt-[var(--space-24)]">
          <h2 className="text-xl">{s.heading[lang]}</h2>
          <div className="mt-2 space-y-3 leading-relaxed">
            {s.body.map((b) => (
              <p key={b.en} className="text-muted">
                {b[lang]}
              </p>
            ))}
          </div>
        </section>
      ))}
    </PolicyPageShell>
  );
}
