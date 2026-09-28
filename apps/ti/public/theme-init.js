(() => {
  let stored = null;
  try {
    stored = localStorage.getItem("raizes-theme");
  } catch {}
  const mode =
    stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  const resolved =
    mode === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.style.colorScheme = resolved;
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme)
    theme.setAttribute("content", resolved === "dark" ? "#08110e" : "#f4f7f4");
})();
