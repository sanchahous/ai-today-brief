/* After Hours prototype v3 — boot. Loaded last: registers the motion atlas, attaches the motion
   layer after every render, and renders exactly once on load. Replaces tension-init.js.
   The motion studies (../after-hours-motion) load every module except this file and boot themselves. */
(() => {
  TensionMotion.registerCatalog();
  let quiet = new URLSearchParams(location.search).get("motion") === "off";
  onRender.push((route) => TensionMotion.mount({ route, lang, quiet }));
  document.addEventListener("tension:preference", (event) => {
    quiet = event.detail.quiet;
    const url = new URL(location.href);
    if (quiet) url.searchParams.set("motion", "off");
    else url.searchParams.delete("motion");
    history.replaceState(history.state, "", url);
  });
  render(false);
})();
