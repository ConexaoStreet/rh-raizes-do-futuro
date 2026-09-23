import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthBoundary } from "./auth";
import App from "./App";
import "./styles.css";
import { initializeTheme } from "./theme";
import ErrorBoundary from "./ErrorBoundary";

initializeTheme();

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  try {
    if (sessionStorage.getItem("raizes-ti-chunk-reload") === "1") return;
    sessionStorage.setItem("raizes-ti-chunk-reload", "1");
  } catch {}
  location.reload();
});
window.setTimeout(() => {
  try {
    sessionStorage.removeItem("raizes-ti-chunk-reload");
  } catch {}
}, 10000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthBoundary>
        <App />
      </AuthBoundary>
    </ErrorBoundary>
  </StrictMode>,
);
