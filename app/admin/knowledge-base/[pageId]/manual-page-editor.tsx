"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ManualPage, ManualPageVersion } from "@/lib/knowledge-base/types";
import { updateManualPageAction, revertManualPageAction, getManualPageHistoryAction } from "./actions";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder-ink-3 focus:border-accent focus:outline-none";
const buttonClass =
  "rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover disabled:opacity-50";

/**
 * Blocks are edited as raw JSON rather than per-type form fields. The manual
 * has six block types (paragraph, table, note, heading, procedure,
 * instrument) with different shapes each — building a form per type is a
 * lot of surface area for content that's edited rarely. JSON.parse
 * validates structure before save; ManualBlocks (the read view) already
 * handles unknown/malformed-looking blocks by falling back to a raw dump,
 * so a bad edit here degrades visibly instead of breaking the page.
 */
export function ManualPageEditor({ pageId, page }: { pageId: string; page: ManualPage }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(page.title);
  const [eyebrow, setEyebrow] = useState(page.eyebrow);
  const [lede, setLede] = useState(page.lede);
  const [status, setStatus] = useState(page.status);
  const [level, setLevel] = useState(page.level);
  const [blocksJson, setBlocksJson] = useState(JSON.stringify(page.blocks, null, 2));
  const [history, setHistory] = useState<ManualPageVersion[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!historyOpen || history !== null) return;
    getManualPageHistoryAction(pageId).then((result) => {
      if (result.data) setHistory(result.data);
      else setError(result.error?.message ?? "Failed to load history.");
    });
  }, [historyOpen, history, pageId]);

  function save() {
    setError(null);
    let blocks: unknown;
    try {
      blocks = JSON.parse(blocksJson);
    } catch {
      setError("Blocks is not valid JSON.");
      return;
    }
    if (!Array.isArray(blocks)) {
      setError("Blocks must be a JSON array.");
      return;
    }

    startTransition(async () => {
      const result = await updateManualPageAction(pageId, {
        num: page.num,
        title,
        eyebrow,
        lede,
        status,
        level,
        blocks: blocks as ManualPage["blocks"],
      });
      if (!result.ok) setError(result.error);
      else {
        setHistory(null);
        router.refresh();
      }
    });
  }

  function revert(versionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revertManualPageAction(pageId, versionId);
      if (!result.ok) setError(result.error);
      else {
        setHistory(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="space-y-3 rounded-lg border border-line p-4">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-2">Title</span>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-2">Eyebrow</span>
          <input className={inputClass} value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-2">Lede</span>
          <textarea
            className={inputClass}
            rows={2}
            value={lede}
            onChange={(e) => setLede(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-2">Status</span>
            <input className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-2">Level</span>
            <input className={inputClass} value={level} onChange={(e) => setLevel(e.target.value)} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-2">Blocks (JSON)</span>
          <textarea
            className={`${inputClass} font-mono text-xs`}
            rows={20}
            value={blocksJson}
            onChange={(e) => setBlocksJson(e.target.value)}
          />
        </label>
        <button className={buttonClass} disabled={pending} onClick={save}>
          Save
        </button>
      </div>

      <div className="space-y-3">
        <button
          className="text-xs font-medium text-ink-2 hover:text-ink"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          {historyOpen ? "Hide" : "Show"} version history
        </button>

        {historyOpen && (
          <div className="divide-y divide-line rounded-lg border border-line">
            {history === null && <p className="px-4 py-3 text-sm text-ink-3">Loading…</p>}
            {history?.length === 0 && (
              <p className="px-4 py-3 text-sm text-ink-3">No prior versions — this page hasn&apos;t been edited yet.</p>
            )}
            {history?.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm text-ink">{v.page.title}</p>
                  <p className="text-xs text-ink-3">
                    {v.authorEmail} · {new Date(v.createdAt).toLocaleString()}
                  </p>
                </div>
                <button className={buttonClass} disabled={pending} onClick={() => revert(v.id)}>
                  Revert to this
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
