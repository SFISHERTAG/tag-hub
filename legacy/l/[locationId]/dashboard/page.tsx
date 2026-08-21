import { getAdSpendTable } from "@/lib/dashboard/ad-spend";
import { AdSpendTable } from "./ad-spend-table";

export const dynamic = "force-dynamic";

function Notice({
  tone,
  title,
  children,
}: {
  tone: "warn" | "error";
  title: string;
  children: React.ReactNode;
}) {
  const styles =
    tone === "warn"
      ? "border-warn/30 bg-warn-tint text-warn"
      : "border-danger/30 bg-danger-tint text-danger";
  return (
    <div className={`max-w-2xl rounded-lg border p-6 ${styles}`}>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  const result = await getAdSpendTable(locationId, 30);

  if (!result.ok) {
    if (result.reason === "not_set_up") {
      return (
        <Notice tone="warn" title="Meta ad account not set up">
          <p>{result.message}</p>
        </Notice>
      );
    }
    return (
      <Notice tone="error" title="Couldn&rsquo;t load ad spend">
        <p className="font-mono text-xs whitespace-pre-wrap">{result.message}</p>
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Spend by ad</h1>
      <AdSpendTable rows={result.rows} />
    </div>
  );
}
