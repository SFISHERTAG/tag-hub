/**
 * Pins this subtree to the dark palette regardless of the light/dark toggle.
 *
 * Every `ink`/`surface`/`line`-based component in ui.tsx — Donut, Fold, Stat —
 * reads these as plain CSS custom properties, which inherit down the DOM tree
 * like any other. Overriding them here means those components render
 * correctly on this page without any prop or variant added to them; the cost
 * is that these values have to be kept in sync with dark theme's own block in
 * globals.css by hand, since nothing enforces that automatically.
 *
 * Values are dark theme's block in globals.css, copied rather than
 * referenced — CSS custom properties can be assigned from another custom
 * property, but not from a value that itself depends on `[data-theme]`,
 * which is exactly the thing this component exists to ignore.
 */
const DARK_SCOPE_STYLE = {
  "--canvas": "#0b0a09",
  "--surface": "#141311",
  "--raised": "#1c1a18",
  "--sunken": "#050505",
  "--line": "#2a2724",
  "--line-strong": "#3a3631",
  "--ink": "#f0ede4",
  "--ink-2": "#a8a49a",
  "--ink-3": "#78746c",
  "--ok": "#3f9d73",
  "--ok-tint": "rgb(63 157 115 / 0.13)",
  "--warn": "#dd8244",
  "--warn-tint": "rgb(221 130 68 / 0.13)",
  "--danger": "#d9584c",
  "--danger-tint": "rgb(217 88 76 / 0.13)",
  "--info": "#8b93a3",
  "--info-tint": "rgb(139 147 163 / 0.13)",
  colorScheme: "dark",
} as React.CSSProperties;

export function DarkScope({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={DARK_SCOPE_STYLE}
      className="-mx-4 -mt-6 -mb-6 min-h-[calc(100vh-7rem)] bg-canvas px-4 py-6 text-ink sm:-mx-6 sm:px-6"
    >
      {children}
    </div>
  );
}
