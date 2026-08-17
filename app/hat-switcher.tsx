"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchRole } from "./role-switcher-actions";
import { ChevronIcon } from "./icons";

type Option = { value: string; label: string; description: string };

export function RoleSwitcher({
  current,
  options,
}: {
  current: string;
  options: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Nothing to choose between — don't imply a control that does nothing.
  if (options.length < 2) return null;

  const active = options.find((o) => o.value === current);

  function choose(role: string) {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await switchRole(role);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-chrome-line px-3 py-2 text-xs font-medium text-chrome-ink transition-colors hover:border-line-strong hover:bg-chrome-hover disabled:opacity-60"
      >
        <span className="truncate">{active?.label ?? current}</span>
        <ChevronIcon
          className={`h-3 w-3 shrink-0 text-chrome-ink-2 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full min-w-48 overflow-hidden rounded-md border border-chrome-line bg-chrome lift-lg"
        >
          <li
            aria-hidden
            className="border-b border-chrome-line px-3 py-1.5 text-[10px] font-medium tracking-wide text-chrome-ink-2 uppercase"
          >
            Switch role
          </li>
          {options.map((option) => {
            const selected = option.value === current;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => choose(option.value)}
                  className={`w-full px-3 py-2 text-left hover:bg-chrome-hover ${
                    selected ? "bg-chrome-hover" : ""
                  }`}
                >
                  <span
                    className={`block text-xs font-medium ${
                      selected ? "text-accent" : "text-chrome-ink"
                    }`}
                  >
                    {option.label}
                  </span>
                  <span className="block text-[11px] text-ink-3">
                    {option.description}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
