/* A manual inspection surface for the homepage's actual WAAPI tracks: The Resolve, frame by frame. */
TensionMotion.mount({ route: "fold-review", lang: "uk" });
const reviewStage = document.querySelector(".brand-stage");
const reviewTime = document.querySelector("#fold-time");
const reviewLabel = document.querySelector("#fold-time-label");
const reviewPlay = document.querySelector("[data-review-play]");
const frameButtons = [...document.querySelectorAll("[data-fold-time]")];
const END = TensionMotion.duration;
// Act boundaries mirror the phase labels inside the scene (tension.js brandTracks).
const act = (time) => (time >= END ? "спокій" : time >= 2050 ? "розв’язка" : time >= 900 ? "редагування" : "сигнали");
const describe = (time) => `${time.toLocaleString("uk-UA")} мс · ${act(time)}`;
let follow = 0;

function pressFrames(time) {
  frameButtons.forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.foldTime) === time)));
}

function inspectFold(time) {
  cancelAnimationFrame(follow);
  TensionMotion.previewBrand(reviewStage, time);
  reviewTime.value = String(time);
  reviewLabel.textContent = describe(time);
  pressFrames(time);
}

/* While the scene plays, the slider follows it. Finite: the loop ends with the scene. */
function followPlayback() {
  cancelAnimationFrame(follow);
  const tick = () => {
    const scene = reviewStage.getAnimations({ subtree: true }).find((animation) => animation.effect?.getTiming().duration === END && animation.playState === "running");
    if (!scene) return;
    const time = Math.min(END, Math.round(scene.currentTime));
    reviewTime.value = String(time);
    reviewLabel.textContent = describe(time);
    follow = requestAnimationFrame(tick);
  };
  follow = requestAnimationFrame(tick);
}

reviewTime.addEventListener("input", () => inspectFold(Number(reviewTime.value)));
frameButtons.forEach((button) => button.addEventListener("click", () => inspectFold(Number(button.dataset.foldTime))));
reviewPlay.addEventListener("click", () => {
  pressFrames(-1);
  TensionMotion.playBrand(reviewStage);
});

function syncReviewState() {
  const off = document.documentElement.dataset.tensionMotion === "off";
  [...frameButtons, reviewPlay, reviewTime].forEach((control) => {
    control.disabled = off;
  });
  if (off) {
    cancelAnimationFrame(follow);
    reviewTime.value = String(END);
    reviewLabel.textContent = "статичний знак · рух вимкнено";
    pressFrames(-1);
    return;
  }
  const state = reviewStage.dataset.brandState;
  if (state === "playing") followPlayback();
  else if (state === "rest") {
    cancelAnimationFrame(follow);
    reviewTime.value = String(END);
    reviewLabel.textContent = describe(END);
  }
}
const reviewState = new MutationObserver(syncReviewState);
reviewState.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tension-motion"] });
reviewState.observe(reviewStage, { attributes: true, attributeFilter: ["data-brand-state"] });
syncReviewState();
