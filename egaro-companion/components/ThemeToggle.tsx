"use client";

// Switches between light and dark and remembers the choice in a cookie.
export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current =
      root.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    document.cookie = `egaro_theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
  }
  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label="Switch between light and dark theme">
      <span className="theme-icon" aria-hidden="true" />
      Theme
    </button>
  );
}
