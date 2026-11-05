(() => {
  "use strict";

  const frame = document.querySelector(".game-frame");
  const rotateNotice = document.getElementById("rotate-notice");
  const modes = [...document.querySelectorAll("[data-display-mode]")];
  if (!frame) return;

  // Mobile gameplay is landscape-only. Keep the 16:9 playfield layout active;
  // in portrait, the stylesheet replaces gameplay UI with a rotate prompt.
  frame.classList.remove("layout-auto", "layout-portrait");
  frame.classList.add("layout-landscape");
  for (const button of modes) button.remove();

  const portraitQuery = window.matchMedia("(orientation: portrait)");
  function updateOrientationPrompt() {
    const isPhone = window.matchMedia("(pointer: coarse) and (max-width: 900px)").matches;
    const shouldPrompt = isPhone && portraitQuery.matches;
    if (rotateNotice) rotateNotice.hidden = !shouldPrompt;
    document.documentElement.classList.toggle("phone-portrait", shouldPrompt);
  }
  portraitQuery.addEventListener?.("change", updateOrientationPrompt);
  window.addEventListener("resize", updateOrientationPrompt, { passive: true });
  updateOrientationPrompt();
})();
