"use client";

import { useEffect, useState } from "react";
import type { FullFramework, FlowScriptSuggestion } from "@/lib/flow/types";

interface FlowFrameworkViewProps {
  orgId: string;
  initialFramework: FullFramework | null;
  /** Can submit a suggested script edit (closer roles). */
  canSuggest: boolean;
  /** Can see and approve/reject pending suggestions (sales manager). */
  canReview: boolean;
}

export function FlowFrameworkView({
  orgId,
  initialFramework,
  canSuggest,
  canReview,
}: FlowFrameworkViewProps) {
  const [framework, setFramework] = useState<FullFramework | null>(initialFramework);
  const [loading, setLoading] = useState(!initialFramework);
  const [error, setError] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    initialFramework?.tabs[0]?.id ?? null,
  );
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [suggestingCardId, setSuggestingCardId] = useState<string | null>(null);

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

      {canReview && <SuggestionsPanel orgId={orgId} framework={framework} />}

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
                  const suggesting = suggestingCardId === card.id;
                  return (
                    <div
                      key={card.id}
                      className="rounded-lg border border-line bg-surface lift"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenCardId(open ? null : card.id);
                          setSuggestingCardId(null);
                        }}
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

                          {canSuggest && (
                            <div className="pt-1">
                              {suggesting ? (
                                <SuggestEditForm
                                  orgId={orgId}
                                  cardId={card.id}
                                  currentContent={card.script?.content ?? ""}
                                  onDone={() => setSuggestingCardId(null)}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSuggestingCardId(card.id)}
                                  className="text-xs font-medium text-accent hover:underline"
                                >
                                  Suggest an edit
                                </button>
                              )}
                            </div>
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

function SuggestEditForm({
  orgId,
  cardId,
  currentContent,
  onDone,
}: {
  orgId: string;
  cardId: string;
  currentContent: string;
  onDone: () => void;
}) {
  const [content, setContent] = useState(currentContent);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (submitted) {
    return (
      <div className="rounded-md border border-ok/30 bg-ok-tint px-3 py-2">
        <p className="text-xs text-ok">Suggestion sent to your sales manager for review.</p>
      </div>
    );
  }

  async function handleSubmit() {
    if (!content.trim()) {
      setError("Suggested script text can't be empty.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/flow/card/${cardId}/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          suggested_content: content,
          suggestion_note: note || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit suggestion");
      setSubmitted(true);
    } catch {
      setError("Couldn't send your suggestion. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-line bg-sunken p-3">
      <div>
        <label className="text-xs font-medium text-ink-2">Suggested script</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-ink-2">Why (optional — what happened on the call)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Send suggestion"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-raised"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function findCardLabel(framework: FullFramework, cardId: string): string {
  for (const tab of framework.tabs) {
    for (const section of tab.sections) {
      const card = section.cards.find((c) => c.id === cardId);
      if (card) return card.label;
    }
  }
  return "Unknown card";
}

function SuggestionsPanel({ orgId, framework }: { orgId: string; framework: FullFramework }) {
  const [suggestions, setSuggestions] = useState<FlowScriptSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/flow/org/${orgId}/suggestions?status=pending`);
        if (res.ok && !cancelled) setSuggestions(await res.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  async function resolve(id: string, action: "approve" | "reject") {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/flow/suggestions/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setSuggestions((current) => current.filter((s) => s.id !== id));
      }
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) return null;

  return (
    <div className="rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-ink">
          Pending script suggestions
          {suggestions.length > 0 && (
            <span className="ml-2 rounded-full bg-accent-tint px-2 py-0.5 text-xs font-medium text-accent-bright">
              {suggestions.length}
            </span>
          )}
        </span>
        <span className="text-xs text-ink-3">{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          {suggestions.length === 0 ? (
            <p className="text-sm text-ink-3">No pending suggestions.</p>
          ) : (
            suggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-md border border-line bg-sunken p-3 space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium text-ink-2">
                    {findCardLabel(framework, suggestion.card_id)}
                  </p>
                  <p className="text-xs text-ink-3">from {suggestion.suggested_by}</p>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink">{suggestion.suggested_content}</p>
                {suggestion.suggestion_note && (
                  <div className="rounded-md bg-raised px-3 py-2">
                    <p className="text-xs font-medium text-ink-2">Why</p>
                    <p className="mt-0.5 text-xs text-ink-3">{suggestion.suggestion_note}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => resolve(suggestion.id, "approve")}
                    disabled={resolvingId === suggestion.id}
                    className="rounded-md bg-ok px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve(suggestion.id, "reject")}
                    disabled={resolvingId === suggestion.id}
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-raised disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
