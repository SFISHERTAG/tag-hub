import type { ManualBlock } from "@/lib/knowledge-base/types";

/**
 * Renders the six block types present in the source manual JSON (paragraph,
 * table, note, heading, procedure, instrument). `instrument` blocks were
 * interactive calculators in the old static HTML build (unit economics,
 * cost-per-call) — that JS isn't ported here, so an instrument renders as a
 * static field/output list. Unknown block types render their raw JSON so
 * content never silently disappears if a new type shows up later.
 */
export function ManualBlocks({ blocks }: { blocks: ManualBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => (
        <ManualBlockView key={i} block={block} />
      ))}
    </div>
  );
}

function ManualBlockView({ block }: { block: ManualBlock }) {
  switch (block.type) {
    case "paragraph":
      return (
        <div className="space-y-2">
          {typeof block.title === "string" && (
            <h3 className="text-sm font-semibold text-ink">{block.title}</h3>
          )}
          {typeof block.content === "string" && (
            <p className="whitespace-pre-line text-sm text-ink-2">{block.content}</p>
          )}
          {typeof block.caveat === "string" && (
            <div className="rounded-md border border-info/30 bg-info-tint p-3 text-sm text-ink-2">
              {typeof block.caveatLabel === "string" && (
                <p className="mb-1 text-xs font-medium text-info">{block.caveatLabel}</p>
              )}
              <p className="whitespace-pre-line">{block.caveat}</p>
            </div>
          )}
        </div>
      );

    case "heading":
      return (
        <div className="space-y-2">
          {typeof block.title === "string" && (
            <h3 className="text-sm font-semibold text-ink">{block.title}</h3>
          )}
          {typeof block.content === "string" && (
            <p className="whitespace-pre-line text-sm text-ink-2">{block.content}</p>
          )}
        </div>
      );

    case "note": {
      const severity = typeof block.severity === "string" ? block.severity : "info";
      const style =
        severity === "hard"
          ? "border-danger/30 bg-danger-tint text-danger"
          : severity === "good"
            ? "border-ok/30 bg-ok-tint text-ok"
            : "border-warn/30 bg-warn-tint text-warn";
      return (
        <div className={`rounded-md border p-3 text-sm ${style}`}>
          {typeof block.title === "string" && <p className="mb-1 font-medium">{block.title}</p>}
          {typeof block.content === "string" && (
            <p className="whitespace-pre-line text-ink-2">{block.content}</p>
          )}
        </div>
      );
    }

    case "table": {
      const headers = Array.isArray(block.headers) ? (block.headers as string[]) : [];
      const rows = Array.isArray(block.rows) ? (block.rows as string[][]) : [];
      return (
        <div className="space-y-2">
          {typeof block.title === "string" && (
            <h3 className="text-sm font-semibold text-ink">{block.title}</h3>
          )}
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs text-ink-3">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 align-top text-ink-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    case "procedure": {
      const steps = Array.isArray(block.steps) ? (block.steps as string[]) : [];
      return (
        <div className="space-y-2">
          {typeof block.title === "string" && (
            <h3 className="text-sm font-semibold text-ink">
              {typeof block.ref === "string" ? `§${block.ref} ` : ""}
              {block.title}
            </h3>
          )}
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {typeof block.warning === "string" && (
            <p className="rounded-md border border-danger/30 bg-danger-tint p-2 text-xs text-danger">
              {block.warning}
            </p>
          )}
          {typeof block.note === "string" && (
            <p className="whitespace-pre-line text-xs text-ink-3">{block.note}</p>
          )}
        </div>
      );
    }

    case "instrument": {
      const fields = Array.isArray(block.fields)
        ? (block.fields as { label: string; default?: string }[])
        : [];
      const outputs = Array.isArray(block.outputs) ? (block.outputs as { label: string }[]) : [];
      return (
        <div className="space-y-2 rounded-md border border-line p-3">
          {typeof block.title === "string" && (
            <h3 className="text-sm font-semibold text-ink">{block.title}</h3>
          )}
          <p className="text-xs text-ink-3">
            Reference values (interactive calculator not ported from the original manual):
          </p>
          <ul className="text-sm text-ink-2">
            {fields.map((f, i) => (
              <li key={i}>
                {f.label}
                {f.default ? ` — ${f.default}` : ""}
              </li>
            ))}
          </ul>
          {outputs.length > 0 && (
            <p className="text-xs text-ink-3">Outputs: {outputs.map((o) => o.label).join(", ")}</p>
          )}
        </div>
      );
    }

    default:
      return (
        <pre className="overflow-x-auto rounded-md border border-line bg-surface p-3 text-xs text-ink-3">
          {JSON.stringify(block, null, 2)}
        </pre>
      );
  }
}
