"use client";

import { useSyncExternalStore } from "react";
import { SunIcon, MoonIcon } from "./icons";

type Choice = "light" | "dark" | "system";

/**
 * Three states, not two. "System" is the default and has to stay reachable —
 * a two-way toggle silently pins the theme the first time it is touched, so a
 * user who flips to dark at night never follows their OS back to light in the
 * morning and assumes the app is broken.
 *
 * The applied theme is written to `data-theme` on <html>, which is what
 * globals.css keys on. `system` removes the attribute so the media query takes
 * over rather than resolving it here — the OS switching at sunset is then
 * picked up live, with no listener.
 *
 * State comes from `useSyncExternalStore` rather than `useState` + `useEffect`.
 * localStorage *is* an external store, and reading it in an effect means the
 * first paint renders the wrong toggle position and then corrects itself. It
 * also gets cross-tab sync for free: the `storage` event fires in other tabs,
 * so changing the theme in one tab moves the control in the rest.
 */

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // `storage` fires in *other* tabs only, which is why `apply` notifies the
  // local listeners itself.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Choice {
  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** The server cannot know the preference; the inline head script applies it. */
function getServerSnapshot(): Choice {
  return "system";
}

function apply(next: Choice) {
  const root = document.documentElement;
  if (next === "system") {
    localStorage.removeItem("theme");
    root.removeAttribute("data-theme");
  } else {
    localStorage.setItem("theme", next);
    root.setAttribute("data-theme", next);
  }
  listeners.forEach((l) => l());
}

const OPTIONS: { value: Choice; label: string; icon?: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "system", label: "Auto" },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
];

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-md border border-chrome-line p-0.5"
    >
      {OPTIONS.map((o) => {
        const active = choice === o.value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            onClick={() => apply(o.value)}
            className={`flex h-6 flex-1 items-center justify-center rounded px-1.5 text-[10px] font-medium transition-colors ${
              active
                ? "bg-accent text-accent-ink"
                : "text-chrome-ink-2 hover:bg-chrome-hover hover:text-white"
            }`}
          >
            {o.icon ?? o.label}
          </button>
        );
      })}
    </div>
  );
}
