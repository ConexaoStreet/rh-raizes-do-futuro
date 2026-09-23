import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import "./styles.css";
import { capture, captureError, observeWebVitals } from "./telemetry";
import { initializeTheme } from "./theme";
import ErrorBoundary from "./ErrorBoundary";

initializeTheme();
observeWebVitals();

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  capture("chunk_load_error");
  try {
    if (sessionStorage.getItem("raizes-chunk-reload") === "1") return;
    sessionStorage.setItem("raizes-chunk-reload", "1");
  } catch {}
  location.reload();
});
window.setTimeout(() => {
  try {
    sessionStorage.removeItem("raizes-chunk-reload");
  } catch {}
}, 10000);

window.addEventListener("error", (event) => captureError("window", event.error));
window.addEventListener("unhandledrejection", (event) => captureError("promise", event.reason));
window.addEventListener("load", () => {
  window.setTimeout(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navigation)
      capture("navigation_performance", {
        duration_ms: Math.round(navigation.duration),
      });
  }, 0);

  if ("serviceWorker" in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });

    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => captureError("service_worker", error));
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
        <Toaster richColors position="top-right" />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
