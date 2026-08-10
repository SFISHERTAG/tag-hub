"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { wearHat } from "./hat-actions";

type Option = { value: string; label: string; description: string };

export function HatSwitcher({
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

  function choose(hat: string) {
    setOpen(false);
    setError(null);
    startTransition(async () => {
      const result = await wearHat(hat);
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
        className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-700 px-3 py-2 text-left text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-60"
      >
        <span>
          <span className="block text-[10px] tracking-wide text-neutral-500 uppercase">
            Viewing as
          </span>
          <span className="block font-medium text-[#ebc507]">
            {active?.label ?? current}
          </span>
        </span>
        <span aria-hidden className="text-neutral-500">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-neutral-700 bg-neutral-950 shadow-xl"
        >
          {options.map((option) => {
            const selected = option.value === current;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => choose(option.value)}
                  className={`w-full px-3 py-2 text-left hover:bg-neutral-900 ${
                    selected ? "bg-neutral-900" : ""
                  }`}
                >
                  <span
                    className={`block text-xs font-medium ${
                      selected ? "text-[#ebc507]" : "text-neutral-200"
                    }`}
                  >
                    {option.label}
                  </span>
                  <span className="block text-[11px] text-neutral-500">
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
