/* The selected motion language for every route of the original prototype. */
(() => {
  TensionMotion.registerCatalog();
  const baseRender = render;
  let quiet = new URLSearchParams(location.search).get("motion") === "off";
  render = function renderTension(reset = true) {
    TensionMotion.unmount();
    baseRender(reset);
    TensionMotion.mount({ route: currentRoute(), lang, quiet });
    document.querySelector(".footer-bottom > div")?.insertAdjacentHTML("beforeend", `<a class="tension-footlink" href="#/motion">${t("Motion atlas ↗", "Атлас руху ↗")}</a>`);
    const preview = document.querySelector(".preview");
    preview?.insertAdjacentHTML("beforeend", `<a href="#/motion">Tension v2 / ${t("Motion atlas ↗", "Атлас руху ↗")}</a>`);
  };
  document.addEventListener("tension:preference", (event) => {
    quiet = event.detail.quiet;
    const url = new URL(location.href);
    if (quiet) url.searchParams.set("motion", "off");
    else url.searchParams.delete("motion");
    history.replaceState(null, "", url);
  });
  render(false);
})();
