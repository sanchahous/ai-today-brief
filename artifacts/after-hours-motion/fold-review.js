/* A manual inspection surface for the homepage's actual WAAPI tracks. */
TensionMotion.mount({ route: "fold-review", lang: "uk" });
const reviewStage = document.querySelector(".brand-fold");
const reviewTime = document.querySelector("#fold-time");
const reviewLabel = document.querySelector("#fold-time-label");
function inspectFold(time) {
  TensionMotion.previewBrand(reviewStage, time);
  reviewTime.value = String(time);
  reviewLabel.textContent = `${time.toLocaleString("uk-UA")} мс`;
  document.querySelectorAll("[data-fold-time]").forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.foldTime) === time));
  });
}
reviewTime.addEventListener("input", () => inspectFold(Number(reviewTime.value)));
document.querySelectorAll("[data-fold-time]").forEach((button) => button.addEventListener("click", () => inspectFold(Number(button.dataset.foldTime))));
document.querySelector("[data-review-play]").addEventListener("click", () => {
  TensionMotion.previewBrand(reviewStage, 0);
  TensionMotion.playBrand(reviewStage, { rewind: false });
  reviewLabel.textContent = "Відтворення 2,2 с";
  document.querySelectorAll("[data-fold-time]").forEach((button) => button.setAttribute("aria-pressed", "false"));
});
function syncReviewState() {
  const off = document.documentElement.dataset.tensionMotion === "off";
  document.querySelectorAll("[data-fold-time],[data-review-play],#fold-time").forEach((control) => { control.disabled = off; });
  if (off) reviewLabel.textContent = "Статичний знак";
  else if (reviewStage.dataset.foldState === "rest") {
    reviewTime.value = "2200";
    reviewLabel.textContent = "2 200 мс · спокій";
  }
}
const reviewState = new MutationObserver(syncReviewState);
reviewState.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tension-motion"] });
reviewState.observe(reviewStage, { attributes: true, attributeFilter: ["data-fold-state"] });
syncReviewState();
