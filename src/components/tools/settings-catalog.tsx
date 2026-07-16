import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import {
  GRAMMAR_REFERENCE,
  HOOK_RECIPES,
  SCOPE_HIERARCHY,
  type Citation,
} from '@/lib/settings-builder-rules';

export function SettingsCatalog({ lang }: { lang: Lang }) {
  const t = getStrings(lang).settingsBuilder;

  return (
    <section className="mt-12" aria-labelledby="settings-catalog">
      <h2 id="settings-catalog" className="text-2xl">
        {t.catalogTitle}
      </h2>
      <p className="text-muted m-0 mt-2 leading-relaxed">{t.catalogLede}</p>

      <section className="mt-8" aria-labelledby="settings-grammar">
        <h3 id="settings-grammar" className="text-xl">
          {t.grammarTitle}
        </h3>
        <div className="mt-4 grid gap-3">
          {GRAMMAR_REFERENCE.map((row) => (
            <article key={row.pattern} className="rounded-card border-border bg-surface border p-4">
              <code className="bg-surface-2 rounded px-2 py-1 text-sm">{row.pattern}</code>
              <p className="text-muted m-0 mt-3 text-sm leading-relaxed">{row.meaning[lang]}</p>
              <CitationList citations={row.citations} lang={lang} label={t.citations} />
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="settings-hooks">
        <h3 id="settings-hooks" className="text-xl">
          {t.hookRecipesTitle}
        </h3>
        <div className="mt-4 grid gap-4">
          {HOOK_RECIPES.map((recipe) => (
            <article key={recipe.id} className="rounded-card border-border bg-surface border p-4">
              <p className="text-faint m-0 font-mono text-[0.72rem]">{recipe.id}</p>
              <h4 className="m-0 mt-1 text-[1.05rem]">{recipe.title[lang]}</h4>
              <p className="text-muted m-0 mt-2 text-sm leading-relaxed">{recipe.useCase[lang]}</p>
              <dl className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                <div>
                  <dt className="text-faint font-semibold">{t.event}</dt>
                  <dd className="m-0 font-mono">{recipe.event}</dd>
                </div>
                <div>
                  <dt className="text-faint font-semibold">{t.matcher}</dt>
                  <dd className="m-0 font-mono">{recipe.matcher || t.anyMatcher}</dd>
                </div>
                <div>
                  <dt className="text-faint font-semibold">{t.severity}</dt>
                  <dd className="m-0">{t.severityLabels[recipe.severity]}</dd>
                </div>
              </dl>
              {recipe.command ? (
                <pre className="border-border bg-surface-2 mt-3 overflow-x-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
                  <code>{recipe.command}</code>
                </pre>
              ) : null}
              <p className="text-muted m-0 mt-3 text-sm leading-relaxed">{recipe.caveat[lang]}</p>
              <CitationList citations={recipe.citations} lang={lang} label={t.citations} />
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="settings-scopes">
        <h3 id="settings-scopes" className="text-xl">
          {t.scopeTitle}
        </h3>
        <div className="mt-4 grid gap-3">
          {SCOPE_HIERARCHY.map((row) => (
            <article key={row.scope} className="rounded-card border-border bg-surface border p-4">
              <p className="text-faint m-0 text-[0.72rem] font-semibold tracking-[0.12em] uppercase">
                #{row.precedence} · {row.scope}
              </p>
              <code className="mt-2 inline-block rounded bg-surface-2 px-2 py-1 text-sm">
                {row.path}
              </code>
              <p className="text-muted m-0 mt-3 text-sm leading-relaxed">{row.note[lang]}</p>
              <CitationList citations={row.citations} lang={lang} label={t.citations} />
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function CitationList({
  citations,
  label,
  lang,
}: {
  citations: readonly Citation[];
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
