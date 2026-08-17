"use client";

import { useEffect, useState } from "react";
import type { FullFramework } from "@/lib/flow/types";

interface FlowFrameworkViewProps {
  orgId: string;
  initialFramework: FullFramework | null;
}

export function FlowFrameworkView({ orgId, initialFramework }: FlowFrameworkViewProps) {
  const [framework, setFramework] = useState<FullFramework | null>(initialFramework);
  const [loading, setLoading] = useState(!initialFramework);
  const [error, setError] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    initialFramework?.tabs[0]?.id ?? null,
  );
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  useEffect(() => {
    if (initialFramework) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/flow/org/${orgId}/framework`);
        if (!res.ok) throw new Error("Failed to load framework");
        const data: FullFramework = await res.json();
        if (cancelled) return;
        setFramework(data);
        setActiveTabId(data.tabs[0]?.id ?? null);
      } catch {
        if (!cancelled) setError("Could not load the FLOW framework.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orgId, initialFramework]);

  if (loading) {
    return <p className="py-6 text-sm text-ink-2">Loading framework...</p>;
  }

  if (error || !framework) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-tint p-6 text-danger">
        <h2 className="text-base font-semibold">Framework unavailable</h2>
        <p className="mt-2 text-sm">{error ?? "No active FLOW framework found for this org."}</p>
      </div>
    );
  }

  const activeTab = framework.tabs.find((t) => t.id === activeTabId) ?? framework.tabs[0];

  return (
    <div className="space-y-4 py-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink">FLOW</h1>
        <p className="mt-1 text-sm text-ink-2">Sales coaching scripts for live calls</p>
      </header>

      <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {framework.tabs.map((tab) => {
          const active = tab.id === activeTab?.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTabId(tab.id);
                setOpenCardId(null);
              }}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-accent-edge bg-accent-tint text-accent-bright"
                  : "border-line bg-surface text-ink-2 hover:bg-raised"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {!activeTab && (
        <p className="py-6 text-sm text-ink-2">This framework has no tabs yet.</p>
      )}

      {activeTab && (
        <div className="space-y-4">
          {activeTab.sections.length === 0 && (
            <p className="py-6 text-sm text-ink-2">No sections in this tab yet.</p>
          )}
          {activeTab.sections.map((section) => (
            <section key={section.id} className="space-y-2">
              <div>
                <h2 className="text-sm font-semibold text-ink">{section.label}</h2>
                {section.description && (
                  <p className="text-xs text-ink-3">{section.description}</p>
                )}
              </div>

              <div className="space-y-2">
                {section.cards.map((card) => {
                  const open = openCardId === card.id;
                  return (
                    <div
                      key={card.id}
                      className="rounded-lg border border-line bg-surface lift"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenCardId(open ? null : card.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      >
                        <span>
                          <span className="block text-sm font-medium text-ink">{card.label}</span>
                          {card.sub_label && (
                            <span className="block text-xs text-ink-3">{card.sub_label}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-ink-3">{open ? "Hide" : "View"}</span>
                      </button>

                      {open && (
                        <div className="space-y-3 border-t border-line px-4 py-3">
                          {card.script ? (
                            <>
                              <p className="whitespace-pre-wrap text-sm text-ink">
                                {card.script.content}
                              </p>
                              {card.script.why && (
                                <div className="rounded-md bg-accent-tint px-3 py-2">
                                  <p className="text-xs font-medium text-accent-bright">Why</p>
                                  <p className="mt-0.5 text-xs text-ink-2">{card.script.why}</p>
                                </div>
                              )}
                              {card.script.notes && (
                                <div className="rounded-md bg-raised px-3 py-2">
                                  <p className="text-xs font-medium text-ink-2">Notes</p>
                                  <p className="mt-0.5 text-xs text-ink-3">{card.script.notes}</p>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-ink-3">No script written for this card yet.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
