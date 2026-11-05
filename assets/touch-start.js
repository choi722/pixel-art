(() => {
  "use strict";
  const startPrompt = document.getElementById("start-prompt");
  const mobileStart = document.getElementById("mobile-start");
  if (!startPrompt || !mobileStart) return;

  // Reuse the game's existing start handler so touch, mouse, and keyboard
  // activation all follow the same code path.
  startPrompt.addEventListener("click", () => mobileStart.click());
})();
