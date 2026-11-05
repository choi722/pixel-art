(() => {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(error => {
      console.warn("오프라인 캐시를 등록할 수 없습니다.", error);
    });
  });
})();
