(() => {
  "use strict";

  const frame = document.querySelector(".game-frame");
  const settings = document.getElementById("control-settings");
  const hint = document.getElementById("orientation-hint");
  const settingsButton = document.getElementById("control-settings-button");
  const modes = [...document.querySelectorAll("[data-display-mode]")];
  if (!frame || !settings) return;

  const storageKey = "pixel-dodge-display-mode";
  const validModes = new Set(["auto", "portrait", "landscape"]);
  let requestedMode = "auto";

  try {
    const savedMode = localStorage.getItem(storageKey);
    if (validModes.has(savedMode)) requestedMode = savedMode;
  } catch (_) { /* Private browsing may disable storage. */ }

  function applyDisplayMode(mode) {
    requestedMode = validModes.has(mode) ? mode : "auto";
    const actualMode = requestedMode === "auto"
      ? (window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape")
      : requestedMode;

    frame.classList.remove("layout-portrait", "layout-landscape");
    frame.classList.add(`layout-${actualMode}`);
    for (const button of modes) {
      button.setAttribute("aria-pressed", String(button.dataset.displayMode === requestedMode));
    }

    const descriptions = {
      auto: "자동 맞춤: 기기 방향에 맞춰 화면을 배치합니다.",
      portrait: "세로 레이아웃입니다. 가로로 돌리면 더 넓게 플레이할 수 있어요.",
      landscape: "가로 레이아웃입니다. 기기를 직접 가로로 돌려 주세요."
    };
    hint.textContent = descriptions[requestedMode];
    try { localStorage.setItem(storageKey, requestedMode); } catch (_) { /* Storage is optional. */ }
  }

  for (const button of modes) {
    button.addEventListener("click", () => applyDisplayMode(button.dataset.displayMode));
  }

  const orientationQuery = window.matchMedia("(orientation: portrait)");
  orientationQuery.addEventListener?.("change", () => {
    if (requestedMode === "auto") applyDisplayMode("auto");
  });

  // Align the setting modal's accessibility state with the existing mobile settings button.
  settingsButton?.addEventListener("click", () => {
    window.setTimeout(() => {
      if (!settings.hidden) modes.find(button => button.getAttribute("aria-pressed") === "true")?.focus();
    }, 0);
  });

  applyDisplayMode(requestedMode);
})();
