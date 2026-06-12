import {
  OFFICIAL_PROMPT_SNIPPETS,
  PROMPT_LINT_RULES,
  type PromptSeverity,
} from '@/lib/prompt-lint-rules';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

const SEVERITIES: readonly PromptSeverity[] = ['issue', 'suggestion', 'info'];

export function RuleCatalog({ lang }: { lang: Lang }) {
  const t = getStrings(lang).promptOptimizer;

  return (
    <section className="mt-12" aria-labelledby="prompt-rules">
      <h2 id="prompt-rules" className="text-2xl">
        {t.ruleCatalogTitle}
      </h2>
      <div className="mt-5 grid gap-4">
        {SEVERITIES.map((severity) => {
          const rules = PROMPT_LINT_RULES.filter((rule) => rule.severity === severity);
          return (
            <section key={severity} aria-labelledby={`rules-${severity}`}>
              <h3 id={`rules-${severity}`} className="text-lg">
                {t.severityLabels[severity]}
              </h3>
              <div className="mt-3 grid gap-3">
                {rules.map((rule) => (
                  <article
                    key={rule.id}
                    className="rounded-card border-border bg-surface border p-4"
                  >
                    <p className="text-faint m-0 font-mono text-[0.72rem]">{rule.id}</p>
                    <h4 className="m-0 mt-1 text-[1.05rem]">{rule.title[lang]}</h4>
                    <p className="text-muted m-0 mt-2 text-sm leading-relaxed">
                      {rule.explainer[lang]}
                    </p>
                    <p className="m-0 mt-3 text-sm leading-relaxed">
                      <strong>{rule.triggerSummary[lang]}</strong> {rule.recommendation[lang]}
                    </p>
                    <CitationList lang={lang} citations={rule.citations} label={t.citations} />
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export function StaticSnippetCatalog({ lang }: { lang: Lang }) {
  const t = getStrings(lang).promptOptimizer;
  return (
    <section className="mt-12" aria-labelledby="official-snippets">
      <h2 id="official-snippets" className="text-2xl">
        {t.staticSnippetsTitle}
      </h2>
      <div className="mt-5 grid gap-3">
        {OFFICIAL_PROMPT_SNIPPETS.map((snippet) => (
          <article key={snippet.id} className="rounded-card border-border bg-surface border p-4">
            <p className="text-faint m-0 text-[0.72rem] tracking-[0.12em] uppercase">
              {t.placementLabels[snippet.placement]}
            </p>
            <h3 className="m-0 mt-1 text-[1.05rem]">{snippet.title[lang]}</h3>
            <p className="text-muted m-0 mt-2 text-sm leading-relaxed">{snippet.purpose[lang]}</p>
            <pre className="border-border bg-surface-2 mt-3 overflow-x-auto rounded-lg border p-3 text-xs leading-relaxed whitespace-pre-wrap">
              <code>{snippet.snippet}</code>
            </pre>
            <CitationList lang={lang} citations={snippet.citations} label={t.citations} />
          </article>
        ))}
      </div>
    </section>
  );
}

function CitationList({
  citations,
  label,
  lang,
}: {
  citations: readonly { label: string; url: string; quote: Partial<Record<Lang, string>> }[];
  label: string;
  lang: Lang;
}) {
  return (
    <div className="mt-3">
      <p className="text-faint m-0 text-[0.76rem] font-semibold tracking-[0.1em] uppercase">
        {label}
      </p>
      <ul className="m-0 mt-1 grid list-none gap-1 p-0 text-sm">
        {citations.map((citation) => (
          <li key={citation.url}>
            <a className="text-accent hover:underline" href={citation.url}>
              {citation.label}
            </a>
            {citation.quote[lang] ? (
              <span className="text-muted"> — {citation.quote[lang]}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
