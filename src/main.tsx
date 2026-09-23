import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import "./styles.css";
import { capture, captureError } from "./telemetry";
import { initializeTheme } from "./theme";

initializeTheme();

window.addEventListener("error", (event) => captureError("window", event.error));
window.addEventListener("unhandledrejection", (event) => captureError("promise", event.reason));
window.addEventListener("load", () => {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigation) capture("navigation_performance", { duration_ms: Math.round(navigation.duration) });
  if ("serviceWorker" in navigator)
    void navigator.serviceWorker.register("/sw.js").catch((error) =>
      captureError("service_worker", error),
    );
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <Toaster richColors position="top-right" />
    </HashRouter>
  </React.StrictMode>,
);
