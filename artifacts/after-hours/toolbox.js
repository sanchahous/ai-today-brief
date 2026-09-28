/* After Hours prototype v3 — Toolbox hub and three local-first workspaces.
   Mirrors src/content/tools.ts and the *-client.tsx tools: surfaces, models, severity tiers,
   permission modes, hook recipes, import/symlink wiring. Rules here are illustrative heuristics;
   production keeps its own rule engines, validation and citations. */

const DOCS = {
  prompt: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview",
  settings: "https://docs.anthropic.com/en/docs/claude-code/settings",
  memory: "https://docs.anthropic.com/en/docs/claude-code/memory",
  hooks: "https://docs.anthropic.com/en/docs/claude-code/hooks",
};
const privacyPromise = (text) => `<p class="privacy-promise">${icon("lock", 18)}<span>${text}</span></p>`;
const toolHead = (tool, lede) =>
  `${breadcrumbs([[t("Home", "Головна"), "home"], ["Toolbox", "tools"], [esc(L(tool.title))]])}<header class="tool-head"><div class="story-labels"><span class="status-chip is-live"><i aria-hidden="true"></i>${t("Live", "Працює")}</span><span class="verified-chip">${icon("check", 14)}${t("Rules last verified", "Правила перевірено")} <time datetime="${tool.lastVerified}">${fmtDate(tool.lastVerified)}</time></span></div><h1>${esc(L(tool.full))}</h1><p class="lede">${lede}</p></header>`;

/* ── 11 / Toolbox hub ──────────────────────────────────────────────────── */
function toolPreview(slug) {
  if (slug === "prompt-optimizer")
    return `<ul class="preview-findings"><li><span class="sev sev-issue">${t("Issue", "Проблема")}</span>${t("No output contract", "Немає контракту результату")}</li><li><span class="sev sev-suggestion">${t("Suggestion", "Порада")}</span>${t("Stable rules first", "Сталі правила — першими")}</li><li><span class="sev sev-info">${t("Info", "Інфо")}</span>≈ 1,240 ${t("tokens", "токенів")}</li></ul>`;
  if (slug === "settings-builder")
    return `<pre class="preview-code" aria-hidden="true">{
  "permissions": {
    "defaultMode": "plan",
    "deny": ["Read(./.env*)"]
  }
}</pre>`;
  return `<ul class="preview-tree" aria-hidden="true"><li>${icon("doc", 16)}AGENTS.md <small>${t("shared rules", "спільні правила")}</small></li><li>${icon("doc", 16)}CLAUDE.md <small>→ @AGENTS.md</small></li></ul>`;
}
function toolsPage() {
  const rules = TOOLS.reduce((n, x) => n + x.rules, 0);
  const cites = TOOLS.reduce((n, x) => n + x.citations, 0);
  return `
  <header class="bench-hero">
    <div>${eyebrow(t("The workbench", "Майстерня"))}<h1>${t("Small tools.<br><em>Considered craft.</em>", "Малі інструменти.<br><em>Продумана робота.</em>")}</h1><p class="lede">${t("Free, bilingual utilities for people who build with AI. Each one is citation-backed and runs entirely in your browser.", "Безкоштовні двомовні утиліти для тих, хто будує з AI. Кожна спирається на цитати й працює повністю у вашому браузері.")}</p>${privacyPromise(t("Your inputs never leave this page — no sign-up, no upload, no model call.", "Ваші дані не залишають сторінку — без реєстрації, завантаження й виклику моделі."))}</div>
    <dl class="bench-panel" aria-label="${t("Toolbox at a glance", "Toolbox коротко")}"><div><dt>${t("live tools", "робочі утиліти")}</dt><dd>${TOOLS.length}</dd></div><div><dt>${t("deterministic rules", "детерміновані правила")}</dt><dd>${rules}</dd></div><div><dt>${t("official citations", "офіційні цитати")}</dt><dd>${cites}</dd></div><div><dt>${t("data sent to us", "даних надсилається нам")}</dt><dd>0</dd></div></dl>
  </header>
  <section class="instrument-grid" aria-label="${t("Tools", "Утиліти")}">${TOOLS.map(
    (tool, i) => `<article class="instrument" aria-labelledby="tool-${tool.slug}">
      <header><span class="instrument-no">0${i + 1}</span><span class="status-chip is-live"><i aria-hidden="true"></i>${t("Live", "Працює")}</span></header>
      <h2 id="tool-${tool.slug}"><a href="${href(tool.route)}">${esc(L(tool.title))}</a></h2>
      <p>${esc(L(tool.desc))}</p>
      <div class="instrument-preview">${toolPreview(tool.slug)}</div>
      <dl class="instrument-facts"><div><dt>${t("Output", "Результат")}</dt><dd>${esc(tool.output)}</dd></div><div><dt>${t("Rules", "Правила")}</dt><dd>${tool.rules} · ${tool.citations} ${t("citations", "цитат")}</dd></div><div><dt>${t("Verified", "Перевірено")}</dt><dd><time datetime="${tool.lastVerified}">${fmtShort(tool.lastVerified)}</time></dd></div></dl>
      <a class="button" href="${href(tool.route)}">${t("Open tool", "Відкрити утиліту")}${icon("arrowRight", 18)}</a>
    </article>`,
  ).join("")}</section>
  <section class="section how-steps" aria-labelledby="how-title">
    ${sectionHead(t("How every tool works.", "Як працює кожна утиліта."), null, "", "how-title")}
    <ol class="steps">${[
      ["lock", t("Your input stays local", "Дані лишаються локально"), t("Nothing is uploaded; there is no account and no model call.", "Нічого не завантажується; немає акаунта й виклику моделі.")],
      ["check", t("Deterministic checks", "Детерміновані перевірки"), t("Rules are fixed and cite the official documentation they come from.", "Правила фіксовані й посилаються на офіційну документацію.")],
      ["copy", t("You review, then copy", "Ви перевіряєте, потім копіюєте"), t("Output is read-only until valid; copy and export are explicit.", "Результат лише для читання, доки не валідний; копіювання — явна дія.")],
    ]
      .map(([ic, h, p], i) => `<li><span class="step-no">0${i + 1}</span><span class="step-icon">${icon(ic, 24)}</span><strong>${h}</strong><span>${p}</span></li>`)
      .join("")}</ol>
  </section>
  <section class="section" aria-labelledby="compare-tools-title">
    ${sectionHead(t("Which tool do you need?", "Яка утиліта вам потрібна?"), null, "", "compare-tools-title")}
    <div class="table-scroll" role="region" aria-labelledby="compare-tools-title" tabindex="0"><table class="compare-table"><thead><tr><th scope="col">${t("Tool", "Утиліта")}</th><th scope="col">${t("You provide", "Ви даєте")}</th><th scope="col">${t("You get", "Ви отримуєте")}</th><th scope="col">${t("Runs", "Де працює")}</th></tr></thead><tbody>
      <tr><th scope="row"><a href="#/tool">Prompt Optimizer</a></th><td>${t("A prompt, surface and model", "Промпт, середовище й модель")}</td><td>${t("Severity-tiered findings, model advice", "Знахідки за рівнями, порада щодо моделі")}</td><td>${t("Browser", "Браузер")}</td></tr>
      <tr><th scope="row"><a href="#/settings">settings.json Builder</a></th><td>${t("Permission mode, presets, hooks", "Режим дозволів, пресети, hooks")}</td><td>settings.json</td><td>${t("Browser", "Браузер")}</td></tr>
      <tr><th scope="row"><a href="#/instructions">CLAUDE.md / AGENTS.md</a></th><td>${t("Project name, stack, guardrails", "Назва, стек, запобіжники")}</td><td>AGENTS.md + CLAUDE.md</td><td>${t("Browser", "Браузер")}</td></tr>
    </tbody></table></div>
  </section>
  <section class="section faq" aria-labelledby="tools-faq-title">
    ${sectionHead(t("Questions about the tools.", "Питання про утиліти."), null, "", "tools-faq-title")}
    <div class="faq-list">${[
      [t("Do you see what I type?", "Чи бачите ви, що я вводжу?"), t("No. The tools run in your browser and send nothing to our servers. Usage analytics, if you consent, count page views only.", "Ні. Утиліти працюють у браузері й нічого не надсилають. Аналітика (за згоди) рахує лише перегляди сторінок.")],
      [t("Why rules instead of an AI model?", "Чому правила, а не AI-модель?"), t("Deterministic rules give the same answer every time and can cite their source. That makes them reviewable.", "Детерміновані правила дають однакову відповідь щоразу й можуть послатися на джерело. Це робить їх перевірними.")],
      [t("How current are the rules?", "Наскільки актуальні правила?"), t("Each tool shows the date its rules were last verified against official documentation.", "Кожна утиліта показує дату, коли її правила востаннє звіряли з документацією.")],
    ]
      .map(([q, a], i) => `<details${i === 0 ? " open" : ""}><summary>${q}</summary><p>${a}</p></details>`)
      .join("")}</div>
    <p class="suggest">${t("Want another tool?", "Потрібна інша утиліта?")} <a href="mailto:editor@aitodaybrief.com?subject=Tool%20idea">${t("Suggest one", "Запропонуйте")}</a></p>
  </section>`;
}

/* ── 12 / Prompt Optimizer ─────────────────────────────────────────────── */
const LINT_RULES = [
  { id: "output-contract", sev: "issue", test: (p) => !/(format|output|return|respond|json|list|table|markdown|формат|поверни)/i.test(p), en: "No output contract: say what the answer should look like.", uk: "Немає контракту результату: опишіть, як має виглядати відповідь." },
  { id: "too-short", sev: "issue", test: (p) => p.trim().length < 80, en: "Very short prompt: add the goal, context and a success check.", uk: "Надто короткий промпт: додайте мету, контекст і перевірку успіху." },
  { id: "role-first", sev: "suggestion", test: (p) => !/(you are|act as|your role|ти —|ви —|твоя роль)/i.test(p), en: "State the role or perspective in the first sentence.", uk: "Вкажіть роль або перспективу в першому реченні." },
  { id: "xml-structure", sev: "suggestion", test: (p) => p.length > 400 && !/<\w+>/.test(p), en: "Long prompt without structure: wrap inputs in XML-style tags.", uk: "Довгий промпт без структури: обгорніть вхідні дані тегами в стилі XML." },
  { id: "shouting", sev: "suggestion", test: (p) => /\b(MUST|NEVER|ALWAYS|CRITICAL|IMPORTANT)\b/.test(p), en: "Aggressive emphasis (MUST, CRITICAL) can cause overreaction in recent models; explain the reason instead.", uk: "Агресивні наголоси (MUST, CRITICAL) можуть викликати надмірну реакцію сучасних моделей; поясніть причину." },
  { id: "step-by-step", sev: "info", test: (p) => /step[- ]by[- ]step|покроково/i.test(p), en: "“Think step by step” is often better served by extended thinking settings.", uk: "«Думай покроково» часто краще замінити налаштуванням extended thinking." },
  { id: "examples", sev: "info", test: (p) => !/(example|e\.g\.|for instance|приклад)/i.test(p), en: "No examples: one short example often clarifies format more than rules do.", uk: "Немає прикладів: один короткий приклад часто пояснює формат краще за правила." },
];
function lintPrompt(prompt, surface, model) {
  const findings = LINT_RULES.filter((rule) => rule.test(prompt)).map((rule) => ({ ...rule, count: 1, position: rule.id === "shouting" ? prompt.search(/\b(MUST|NEVER|ALWAYS|CRITICAL|IMPORTANT)\b/) : null }));
  if (surface === "claude-code" && !/(test|lint|verify|перевір)/i.test(prompt)) findings.push({ id: "verification-step", sev: "suggestion", en: "Claude Code runs commands: name the verification command (tests, lint).", uk: "Claude Code виконує команди: назвіть команду перевірки (тести, lint)." });
  const tokens = Math.max(1, Math.round(prompt.length / 3.8));
  const heavy = tokens > 1500 || /refactor|architecture|migrat|архітект|рефактор/i.test(prompt);
  return { findings, tokens, recommendation: { model: heavy ? "Opus" : model === "haiku" ? "Haiku" : "Sonnet", effort: heavy ? t("High", "Високе") : t("Medium", "Середнє"), reasons: heavy ? t("Long or architectural task", "Довга або архітектурна задача") : t("Focused, well-scoped task", "Сфокусована, чітко окреслена задача") } };
}
function lintReport(result) {
  const groups = ["issue", "suggestion", "info"];
  const names = { issue: [t("Issues", "Проблеми"), t("issue", "проблема")], suggestion: [t("Suggestions", "Поради"), t("suggestion", "порада")], info: [t("Info", "Інфо"), t("info", "інфо")] };
  if (!result.findings.length)
    return `<div class="lint-clean">${icon("check", 26)}<p><strong>${t("No rules triggered for this model and surface.", "Жодне правило не спрацювало для цієї моделі й середовища.")}</strong>${t("That is not a guarantee of quality — test the prompt on a real task.", "Це не гарантія якості — перевірте промпт на реальній задачі.")}</p></div>`;
  return `<ul class="lint-summary">${groups.map((g) => `<li class="sev-${g}"><strong>${result.findings.filter((f) => f.sev === g).length}</strong>${names[g][0]}</li>`).join("")}</ul>
  <ol class="findings">${groups
    .flatMap((g) => result.findings.filter((f) => f.sev === g))
    .map((f) => `<li class="finding"><span class="sev sev-${f.sev}">${names[f.sev][1]}</span><div><p>${esc(t(f.en, f.uk))}</p><p class="finding-meta"><code>${f.id}</code>${f.position != null && f.position >= 0 ? ` · ${t("approximate position", "приблизна позиція")} ${f.position}` : ""} · <a href="${DOCS.prompt}" target="_blank" rel="noopener">${t("Citation", "Цитата")}${icon("external", 14)}</a></p></div></li>`)
    .join("")}</ol>`;
}
function tool() {
  const t0 = TOOLS[0];
  return `${toolHead(t0, t("Paste a prompt, choose where you will run it, and get deterministic suggestions grounded in official Claude prompting guidance.", "Вставте промпт, оберіть середовище — і отримайте детерміновані поради з офіційного гайда Claude з промптів."))}
  ${privacyPromise(t("Lint runs locally; we do not see your prompt text.", "Лінтинг працює локально; ми не бачимо текст промпту."))}
  <div class="workbench">
    <section class="workbench-panel" aria-labelledby="wb-input"><h2 id="wb-input" class="panel-title"><span>01</span>${t("Your prompt", "Ваш промпт")}</h2>
      <form data-form="lint" novalidate>
        <fieldset class="field"><legend>${t("Where will you run this prompt?", "Де запускатимете промпт?")}</legend><p class="field-help" id="surface-help">${t("The surface changes which rules apply.", "Середовище визначає, які правила застосовуються.")}</p><div class="segmented" aria-describedby="surface-help">${[["api", "API"], ["claude-code", "Claude Code"], ["claude-ai", "claude.ai"]].map(([v, l], i) => `<label><input type="radio" name="surface" value="${v}"${i === 1 ? " checked" : ""}><span>${l}</span></label>`).join("")}</div></fieldset>
        <div class="field"><label for="lint-model">${t("Target model", "Цільова модель")}</label><select id="lint-model" name="model"><option value="opus">Claude Opus</option><option value="sonnet" selected>Claude Sonnet</option><option value="haiku">Claude Haiku</option></select></div>
        <div class="field"><label for="lint-prompt">${t("Prompt to lint", "Промпт для перевірки")}</label><textarea id="lint-prompt" name="prompt" rows="9" required aria-describedby="lint-count lint-error" placeholder="${t("You are a senior reviewer. Review this pull request for correctness…", "Ви — старший рев’юер. Перевірте цей pull request на коректність…")}"></textarea><p class="field-help" id="lint-count" aria-live="polite">0 ${t("characters", "символів")} · ≈ 0 ${t("tokens", "токенів")}</p><p class="field-error" id="lint-error" hidden>${t("Paste a prompt first.", "Спершу вставте промпт.")}</p></div>
        <div class="button-row"><button class="button">${icon("check", 18)}${t("Run local lint", "Перевірити локально")}</button><button type="button" class="button ghost" data-action="lint-sample">${t("Use a sample", "Взяти приклад")}</button></div>
      </form>
    </section>
    <section class="workbench-panel output-panel" aria-labelledby="wb-output"><h2 id="wb-output" class="panel-title"><span>02</span>${t("Findings", "Знахідки")}</h2>
      <div id="lint-output" class="lint-output" aria-live="polite"><p class="panel-empty">${icon("info", 20)}${t("Run the linter to see severity-tiered findings.", "Запустіть перевірку, щоб побачити знахідки за рівнями.")}</p></div>
      <div id="lint-reco" class="reco" hidden></div>
      <p class="field-note">${t("Heuristic, not a quality score. Rules cite official guidance; your judgment decides.", "Евристика, а не оцінка якості. Правила посилаються на офіційний гайд; рішення — за вами.")}</p>
    </section>
  </div>
  <section class="section" aria-labelledby="snippets-title">${sectionHead(t("Official snippets library", "Бібліотека офіційних сніпетів"), null, "", "snippets-title")}<div class="snippet-grid">${[
    ["snippet-role", t("Role & goal", "Роль і мета"), "You are a {role}. Your goal is {outcome}.\nSuccess means {check}."],
    ["snippet-xml", t("Structured inputs", "Структуровані вхідні дані"), "<context>\n{files or notes}\n</context>\n<task>\n{what to do}\n</task>"],
    ["snippet-output", t("Output contract", "Контракт результату"), "Return a markdown table with columns:\nrisk | evidence | fix. No prose outside it."],
  ]
    .map(([id, title, code]) => `<figure class="snippet"><figcaption><span>${title}</span><button type="button" class="pill pill-sm" data-action="copy-text" data-target="${id}">${icon("copy", 14)}${t("Copy snippet", "Копіювати")}</button></figcaption><pre tabindex="0"><code id="${id}">${esc(code)}</code></pre></figure>`)
    .join("")}</div></section>
  <details class="catalog"><summary>${t("Rules this linter checks", "Правила, які перевіряє лінтер")} · ${LINT_RULES.length}</summary><div class="table-scroll" role="region" aria-label="${t("Rule catalog", "Каталог правил")}" tabindex="0"><table><thead><tr><th scope="col">${t("Rule", "Правило")}</th><th scope="col">${t("Tier", "Рівень")}</th><th scope="col">${t("What it checks", "Що перевіряє")}</th></tr></thead><tbody>${LINT_RULES.map((r) => `<tr><td><code>${r.id}</code></td><td><span class="sev sev-${r.sev}">${r.sev}</span></td><td>${esc(t(r.en, r.uk))}</td></tr>`).join("")}</tbody></table></div></details>`;
}
FORMS.lint = (form) => {
  const prompt = form.prompt.value;
  const error = document.getElementById("lint-error");
  if (!prompt.trim()) {
    error.hidden = false;
    form.prompt.setAttribute("aria-invalid", "true");
    form.prompt.focus();
    return;
  }
  error.hidden = true;
  form.prompt.removeAttribute("aria-invalid");
  const result = lintPrompt(prompt, form.surface.value, form.model.value);
  document.getElementById("lint-output").innerHTML = lintReport(result);
  const reco = document.getElementById("lint-reco");
  reco.hidden = false;
  reco.innerHTML = `<p class="rail-title">${t("Model recommendation", "Рекомендація моделі")}</p><dl><div><dt>${t("Recommended model", "Рекомендована модель")}</dt><dd>Claude ${result.recommendation.model}</dd></div><div><dt>${t("Effort", "Зусилля")}</dt><dd>${result.recommendation.effort}</dd></div><div><dt>${t("Reasons", "Причини")}</dt><dd>${result.recommendation.reasons}</dd></div><div><dt>${t("Approximate token range", "Приблизний діапазон токенів")}</dt><dd>${Math.round(result.tokens * 0.85)}–${Math.round(result.tokens * 1.15)}</dd></div></dl>`;
};
ACTIONS["lint-sample"] = () => {
  const area = document.getElementById("lint-prompt");
  area.value = t("Review this pull request. It is CRITICAL that you find all bugs. Think step by step.", "Переглянь цей pull request. КРИТИЧНО знайти всі баги. Думай покроково.");
  area.dispatchEvent(new Event("input", { bubbles: true }));
  area.focus();
};
document.addEventListener("input", (event) => {
  if (event.target.id !== "lint-prompt") return;
  const n = event.target.value.length;
  document.getElementById("lint-count").textContent = `${n.toLocaleString(locale())} ${t("characters", "символів")} · ≈ ${Math.round(n / 3.8).toLocaleString(locale())} ${t("tokens", "токенів")}`;
});

/* ── settings.json Builder ─────────────────────────────────────────────── */
/* Labels are functions so they follow the language at render time, not at script load. */
const MODES = [
  ["default", () => t("Default — ask on first tool use", "Типовий — питати при першому використанні"), "info"],
  ["acceptEdits", () => t("Accept edits", "Приймати правки"), "warning"],
  ["plan", () => t("Plan mode", "Режим плану"), "info"],
  ["dontAsk", () => t("Do not ask — deny unapproved tools", "Не питати — відхиляти несхвалене"), "info"],
  ["bypassPermissions", () => t("Bypass permissions", "Обійти дозволи"), "critical"],
];
function settingsWorkspace() {
  const tool0 = TOOLS[1];
  const modes = MODES.map(([id, label, sev]) => [id, typeof label === "function" ? label() : label, sev]);
  return `${toolHead(tool0, t("Choose the guardrails your project needs and produce deterministic settings.json scaffolding — without sending repository details anywhere.", "Оберіть запобіжники для проєкту й отримайте детермінований scaffold settings.json — без надсилання деталей репозиторію."))}
  ${privacyPromise(t("100% client-side; your choices never leave this browser.", "100% у браузері; ваш вибір не залишає браузер."))}
  <div class="workbench">
    <section class="workbench-panel" aria-labelledby="set-input"><h2 id="set-input" class="panel-title"><span>01</span>${t("Guardrails", "Запобіжники")}</h2>
      <form data-form="settings">
        <fieldset class="field"><legend>${t("Default permission mode", "Типовий режим дозволів")}</legend><p class="field-help">${t("What Claude Code does before a tool is approved.", "Що робить Claude Code до схвалення інструмента.")}</p><div class="radio-stack">${modes.map(([id, label, sev], i) => `<label class="radio-row"><input type="radio" name="mode" value="${id}"${i === 2 ? " checked" : ""}><span>${label}</span>${sev === "critical" ? `<span class="sev sev-issue">${t("critical", "критично")}</span>` : ""}</label>`).join("")}</div></fieldset>
        <fieldset class="field"><legend>${t("Safety permission presets", "Безпечні пресети дозволів")}</legend><div class="check-stack">${[
          ["deny-env", t("Deny reading .env and secrets", "Заборонити читання .env і секретів"), true],
          ["deny-net", t("Deny curl / wget network calls", "Заборонити мережеві curl / wget"), true],
          ["ask-push", t("Ask before git push", "Питати перед git push"), true],
          ["allow-test", t("Allow running the test command", "Дозволити запуск тестів"), false],
        ].map(([id, label, on]) => `<label class="check-row plain"><input type="checkbox" name="${id}"${on ? " checked" : ""}><span class="check-label">${label}</span></label>`).join("")}</div></fieldset>
        <fieldset class="field"><legend>${t("Hook recipes", "Рецепти hooks")}</legend><div class="check-stack">${[
          ["hook-format", "PostToolUse · Edit → prettier", false],
          ["hook-block", "PreToolUse · Bash → block rm -rf", true],
        ].map(([id, label, on]) => `<label class="check-row plain"><input type="checkbox" name="${id}"${on ? " checked" : ""}><span class="check-label"><code>${label}</code></span></label>`).join("")}</div></fieldset>
        <button class="button">${t("Build settings.json", "Зібрати settings.json")}${icon("arrowRight", 18)}</button>
      </form>
    </section>
    <section class="workbench-panel output-panel" aria-labelledby="set-output"><h2 id="set-output" class="panel-title"><span>02</span>${t("Generated settings.json", "Згенерований settings.json")}</h2>
      <div id="settings-warnings" aria-live="polite"></div>
      <pre id="settings-output" class="output-code" tabindex="0" aria-live="polite">${t("Choose guardrails and build to preview the file.", "Оберіть запобіжники й зберіть, щоб побачити файл.")}</pre>
      <div class="button-row"><button type="button" class="button outline" data-action="copy-text" data-target="settings-output" disabled data-needs-output>${icon("copy", 18)}${t("Copy settings.json", "Копіювати settings.json")}</button></div>
      <p class="field-note">${t("Paste into .claude/settings.json. Validate against the current schema before committing.", "Вставте в .claude/settings.json. Перед комітом звірте з актуальною схемою.")} <a href="${DOCS.settings}" target="_blank" rel="noopener">${t("Settings docs", "Документація")}${icon("external", 14)}</a></p>
    </section>
  </div>
  <details class="catalog"><summary>${t("Permission rule grammar & scope precedence", "Граматика правил і пріоритет областей")}</summary><div class="grid2 catalog-grid"><div class="table-scroll" role="region" aria-label="${t("Rule grammar", "Граматика правил")}" tabindex="0"><table><thead><tr><th scope="col">${t("Rule", "Правило")}</th><th scope="col">${t("Matches", "Відповідає")}</th></tr></thead><tbody><tr><td><code>Read(./.env*)</code></td><td>${t("Reading env files", "Читання env-файлів")}</td></tr><tr><td><code>Bash(npm test:*)</code></td><td>${t("The test command and its arguments", "Команда тестів з аргументами")}</td></tr><tr><td><code>WebFetch(domain:docs.x.com)</code></td><td>${t("Fetches from one domain", "Запити до одного домену")}</td></tr></tbody></table></div><ol class="scope-list"><li><strong>Managed</strong>${t("organisation policy — highest", "політика організації — найвищий")}</li><li><strong>CLI</strong>${t("flags for this session", "прапорці сесії")}</li><li><strong>Local</strong>.claude/settings.local.json</li><li><strong>Project</strong>.claude/settings.json</li><li><strong>User</strong>~/.claude/settings.json</li></ol></div></details>`;
}
FORMS.settings = (form) => {
  const data = new FormData(form);
  const mode = data.get("mode");
  const deny = [];
  const ask = [];
  const allow = ["Read"];
  if (data.get("deny-env")) deny.push("Read(./.env*)", "Read(./secrets/**)");
  if (data.get("deny-net")) deny.push("Bash(curl:*)", "Bash(wget:*)");
  if (data.get("ask-push")) ask.push("Bash(git push:*)");
  if (data.get("allow-test")) allow.push("Bash(npm test:*)");
  const hooks = {};
  if (data.get("hook-format")) hooks.PostToolUse = [{ matcher: "Edit|Write", hooks: [{ type: "command", command: "npx prettier --write \"$CLAUDE_FILE_PATHS\"" }] }];
  if (data.get("hook-block")) hooks.PreToolUse = [{ matcher: "Bash", hooks: [{ type: "command", command: "./.claude/hooks/block-rm-rf.sh" }] }];
  const settings = { $schema: "https://json.schemastore.org/claude-code-settings.json", permissions: { defaultMode: mode, allow, ...(ask.length ? { ask } : {}), deny } };
  if (Object.keys(hooks).length) settings.hooks = hooks;
  document.getElementById("settings-output").textContent = JSON.stringify(settings, null, 2);
  const warnings = [];
  if (mode === "bypassPermissions") warnings.push(["issue", t("Critical: bypassPermissions skips every check. Use only in an isolated container.", "Критично: bypassPermissions пропускає всі перевірки. Лише в ізольованому контейнері.")]);
  if (mode === "acceptEdits") warnings.push(["suggestion", t("Warning: edits are applied without asking. Keep git clean to review diffs.", "Попередження: правки застосовуються без запиту. Тримайте git чистим для рев’ю diff.")]);
  if (!deny.length) warnings.push(["suggestion", t("No deny rules: secrets and network are unrestricted.", "Немає deny-правил: секрети й мережа без обмежень.")]);
  document.getElementById("settings-warnings").innerHTML = warnings.length
    ? `<ul class="warn-list">${warnings.map(([sev, text]) => `<li><span class="sev sev-${sev}">${sev === "issue" ? t("critical", "критично") : t("warning", "увага")}</span>${text}</li>`).join("")}</ul>`
    : `<p class="notice notice-ok">${icon("check", 18)}${t("No warnings for this configuration.", "Для цієї конфігурації попереджень немає.")}</p>`;
  document.querySelector('[data-target="settings-output"]').disabled = false;
};

/* ── CLAUDE.md / AGENTS.md Generator ───────────────────────────────────── */
function instructionsWorkspace() {
  const tool0 = TOOLS[2];
  return `${toolHead(tool0, t("Draft portable agent instructions, choose import or symlink wiring, and lint the result before copying it into your repository.", "Створіть портативні інструкції, оберіть import чи symlink wiring і перевірте результат перед копіюванням у репозиторій."))}
  ${privacyPromise(t("100% client-side; project instructions stay in this browser.", "100% у браузері; інструкції проєкту лишаються в браузері."))}
  <div class="workbench">
    <section class="workbench-panel" aria-labelledby="ins-input"><h2 id="ins-input" class="panel-title"><span>01</span>${t("Project context", "Контекст проєкту")}</h2>
      <form data-form="instructions" novalidate>
        <div class="field"><label for="proj-name">${t("Project name", "Назва проєкту")}</label><input id="proj-name" name="name" required placeholder="${t("e.g. Acme API", "напр. Acme API")}" aria-describedby="proj-error"><p class="field-error" id="proj-error" hidden>${t("Enter a project name.", "Введіть назву проєкту.")}</p></div>
        <div class="field"><label for="proj-stack">${t("Project stack", "Стек проєкту")}</label><select id="proj-stack" name="stack"><option value="typescript">TypeScript / Node.js</option><option value="python">Python</option><option value="generic">${t("Generic — I will fill in the commands", "Загальний — команди додам сам")}</option></select></div>
        <fieldset class="field"><legend>${t("Include guardrails", "Додати запобіжники")}</legend><div class="check-stack"><label class="check-row plain"><input type="checkbox" name="plan" checked><span class="check-label">${t("Ask for a plan before larger changes", "Просити план перед великими змінами")}</span></label><label class="check-row plain"><input type="checkbox" name="tests" checked><span class="check-label">${t("Add a focused test verification step", "Додати крок перевірки тестами")}</span></label><label class="check-row plain"><input type="checkbox" name="lint"><span class="check-label">${t("Add a lint verification step", "Додати крок перевірки lint")}</span></label></div></fieldset>
        <fieldset class="field"><legend>${t("Wiring", "Підключення")}</legend><div class="segmented"><label><input type="radio" name="wiring" value="import" checked><span>@import</span></label><label><input type="radio" name="wiring" value="symlink"><span>symlink</span></label></div></fieldset>
        <button class="button">${t("Generate docs", "Згенерувати")}${icon("arrowRight", 18)}</button>
      </form>
    </section>
    <section class="workbench-panel output-panel" aria-labelledby="ins-output"><h2 id="ins-output" class="panel-title"><span>02</span>AGENTS.md + CLAUDE.md</h2>
      <div class="file-tabs" role="tablist" aria-label="${t("Generated files", "Згенеровані файли")}"><button type="button" role="tab" id="tab-agents" aria-selected="true" aria-controls="panel-agents" data-action="file-tab" data-file="agents">AGENTS.md</button><button type="button" role="tab" id="tab-claude" aria-selected="false" aria-controls="panel-claude" tabindex="-1" data-action="file-tab" data-file="claude">CLAUDE.md</button></div>
      <div role="tabpanel" id="panel-agents" aria-labelledby="tab-agents"><pre id="agents-output" class="output-code" tabindex="0">${t("Your shared instructions will appear here.", "Тут з’являться спільні інструкції.")}</pre><button type="button" class="button outline" data-action="copy-text" data-target="agents-output" disabled data-needs-output>${icon("copy", 18)}${t("Copy AGENTS.md", "Копіювати AGENTS.md")}</button></div>
      <div role="tabpanel" id="panel-claude" aria-labelledby="tab-claude" hidden><pre id="claude-output" class="output-code" tabindex="0">${t("Claude-specific wiring will appear here.", "Тут з’явиться підключення для Claude.")}</pre><button type="button" class="button outline" data-action="copy-text" data-target="claude-output" disabled data-needs-output>${icon("copy", 18)}${t("Copy CLAUDE.md", "Копіювати CLAUDE.md")}</button></div>
      <div id="instructions-lint" aria-live="polite"></div>
      <p class="field-note"><a href="${DOCS.memory}" target="_blank" rel="noopener">${t("Read the official Claude Code memory guide", "Офіційний гайд Claude Code про пам’ять")}${icon("external", 14)}</a></p>
    </section>
  </div>`;
}
FORMS.instructions = (form) => {
  const name = form.name.value.trim();
  const error = document.getElementById("proj-error");
  if (!name) {
    error.hidden = false;
    form.name.setAttribute("aria-invalid", "true");
    form.name.focus();
    return;
  }
  error.hidden = true;
  form.name.removeAttribute("aria-invalid");
  const commands = { typescript: ["npm run lint", "npm test"], python: ["ruff check .", "pytest -q"], generic: ["<lint command>", "<test command>"] }[form.stack.value];
  const lines = [`# ${name}`, "", "## Working agreements", "- Keep changes small and reviewable."];
  if (form.plan.checked) lines.push("- Propose a short plan before larger or cross-cutting changes.");
  if (form.tests.checked) lines.push(`- Verify with \`${commands[1]}\` before reporting done.`);
  if (form.lint.checked) lines.push(`- Run \`${commands[0]}\`; do not auto-fix unrelated files.`);
  lines.push("", "## Boundaries", "- Never commit secrets or .env files.", "- Ask before deleting data or pushing to shared branches.");
  document.getElementById("agents-output").textContent = lines.join("\n");
  document.getElementById("claude-output").textContent = form.wiring.value === "import" ? "# Claude Code\n@AGENTS.md\n\n## Claude-specific\n- Prefer plan mode for multi-file work." : "# Claude Code\n# CLAUDE.md is a symlink to AGENTS.md:\n#   ln -s AGENTS.md CLAUDE.md";
  document.getElementById("instructions-lint").innerHTML = `<ul class="warn-list is-ok"><li><span class="sev sev-info">${t("ok", "ок")}</span>${t("CLAUDE.md wires AGENTS.md — one source of truth.", "CLAUDE.md підключає AGENTS.md — одне джерело правди.")}</li>${form.tests.checked ? "" : `<li><span class="sev sev-suggestion">${t("tip", "порада")}</span>${t("Add a verification step so the agent can prove its work.", "Додайте крок перевірки, щоб агент міг довести результат.")}</li>`}</ul>`;
  document.querySelectorAll("[data-needs-output]").forEach((b) => (b.disabled = false));
};
ACTIONS["file-tab"] = (el) => {
  document.querySelectorAll('[data-action="file-tab"]').forEach((tab) => {
    const on = tab === el;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !on;
  });
};
document.addEventListener("keydown", (event) => {
  const tab = event.target.closest?.('[role="tab"][data-action="file-tab"]');
  if (!tab || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  const tabs = [...document.querySelectorAll('[data-action="file-tab"]')];
  const next = tabs[(tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
  ACTIONS["file-tab"](next);
  next.focus();
});

Object.assign(renderers, { tools: toolsPage, tool, settings: settingsWorkspace, instructions: instructionsWorkspace });
