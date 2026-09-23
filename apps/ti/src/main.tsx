import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthBoundary } from "./auth";
import App from "./App";
import "./styles.css";
import { initializeTheme } from "./theme";
import ErrorBoundary from "./ErrorBoundary";

initializeTheme();

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
