/* Additional functional-page mockups. Outputs are illustrative templates. */
routes.push("settings", "instructions");
function settingsWorkspace() {
  return `${intro("TOOLBOX / SETTINGS.JSON", t("Make permissions<br><em>explicit.</em>", "Зробіть дозволи<br><em>явними.</em>"), t("A visual settings-builder concept. Review the generated preview before using the production tool.", "Візуальна концепція конструктора налаштувань. Перевірте preview перед використанням реальної утиліти."))}
  <div class="workbench"><section><form id="settings-demo">${eyebrow(t("01 / PERMISSIONS", "01 / ДОЗВОЛИ"))}
  <label for="permission-profile">${t("Starting profile", "Початковий профіль")}</label><select id="permission-profile"><option value="review">${t("Review only", "Лише перевірка")}</option><option value="edit">${t("Review and propose edits", "Перевірка й пропозиції змін")}</option></select>
  <label><input type="checkbox" id="deny-secrets" checked style="min-height:0"> ${t("Exclude environment secrets", "Виключити секрети середовища")}</label>
  <div class="status-banner spaced">${t("Example fields only. Use the existing validator and supported permission syntax in production.", "Приклад полів. У реалізації використовуйте наявний валідатор і підтримуваний синтаксис дозволів.")}</div>
  <button class="button">${t("Preview configuration", "Переглянути конфігурацію")} ↗</button></form></section>
  <section aria-live="polite">${eyebrow("02 / SETTINGS.JSON")}<pre id="settings-output" class="spaced">${t("Choose a profile to preview the document.", "Оберіть профіль для перегляду документа.")}</pre><button class="button outline spaced" data-copy-generated="settings-output" disabled>${t("Copy preview", "Копіювати preview")}</button></section></div>`;
}
function instructionsWorkspace() {
  return `${intro("TOOLBOX / PROJECT INSTRUCTIONS", t("A shared understanding.<br><em>Written down.</em>", "Спільне розуміння.<br><em>Зафіксоване письмово.</em>"), t("Separate reusable project instructions from tool-specific wiring.", "Розділіть багаторазові інструкції проєкту й налаштування конкретного інструмента."))}
  <div class="workbench"><section><form id="instructions-demo">${eyebrow(t("01 / PROJECT CONTEXT", "01 / КОНТЕКСТ ПРОЄКТУ"))}
  <label for="project-name">${t("Project name", "Назва проєкту")}</label><input class="wide-input" id="project-name" required placeholder="AI Today Brief">
  <label for="project-rules">${t("Constraints and review rules", "Обмеження й правила перевірки")}</label><textarea id="project-rules" rows="6" required placeholder="${t("Keep changes small. Review the diff.", "Робити невеликі зміни. Перевіряти diff.")}"></textarea>
  <button class="button spaced">${t("Build the draft", "Створити чернетку")} ↗</button></form></section>
  <section aria-live="polite">${eyebrow("02 / AGENTS.MD + CLAUDE.MD")}<pre id="instructions-output" class="spaced">${t("Your instruction draft will appear here.", "Тут з’явиться чернетка інструкцій.")}</pre><button class="button outline spaced" data-copy-generated="instructions-output" disabled>${t("Copy draft", "Копіювати чернетку")}</button><p class="form-note">${t("Local template demo. Inspect and edit before use.", "Демонстрація локального шаблону. Перевірте й відредагуйте перед використанням.")}</p></section></div>`;
}
renderers.settings = settingsWorkspace;
renderers.instructions = instructionsWorkspace;
document.addEventListener("submit", (event) => {
  if (event.target.id === "settings-demo") {
    event.preventDefault();
    const review = document.getElementById("permission-profile").value === "review";
    const deny = document.getElementById("deny-secrets").checked;
    document.getElementById("settings-output").textContent = JSON.stringify(
      {
        $comment: "Design preview only — validate against the existing production tool",
        permissions: {
          allow: review ? ["Read"] : ["Read", "Edit"],
          deny: deny ? ["Read(.env*)"] : [],
        },
      },
      null,
      2,
    );
    document.querySelector('[data-copy-generated="settings-output"]').disabled = false;
  }
  if (event.target.id === "instructions-demo") {
    event.preventDefault();
    const name = document.getElementById("project-name").value.trim();
    const rules = document.getElementById("project-rules").value.trim();
    document.getElementById("instructions-output").textContent =
      `AGENTS.md\n─────────\n# ${name}\n\n${rules}\n\nCLAUDE.md\n─────────\n@AGENTS.md`;
    document.querySelector('[data-copy-generated="instructions-output"]').disabled = false;
  }
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-copy-generated]");
  if (button) copy(document.getElementById(button.dataset.copyGenerated).textContent);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const dialog = document.getElementById("search-dialog");
    if (dialog.open) dialog.close();
    const nav = document.querySelector(".nav");
    if (nav?.classList.contains("open")) {
      nav.classList.remove("open");
      document.querySelector("[data-menu]").setAttribute("aria-expanded", "false");
      document.querySelector("[data-menu]").focus();
    }
  }
});
render();
