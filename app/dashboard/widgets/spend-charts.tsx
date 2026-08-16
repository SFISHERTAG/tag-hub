import { Panel, Donut, BarChart, type Segment, type BarGroup } from "../../ui";
import type { MockMetrics } from "@/lib/dashboard/mock-metrics";

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Only two channels exist today, so two tones is enough — add a third if Google/TikTok/etc. joins. */
const CHANNEL_TONE: Record<string, Segment["tone"]> = {
  Meta: "accent",
  Google: "info",
};

export function SpendCharts({
  spendByChannel,
  spendByAd,
}: {
  spendByChannel: MockMetrics["spendByChannel"];
  spendByAd: MockMetrics["spendByAd"];
}) {
  const total = spendByChannel.reduce((s, c) => s + c.amount, 0);

  const segments: Segment[] = spendByChannel.map((c) => ({
    label: c.channel,
    value: c.amount,
    tone: CHANNEL_TONE[c.channel] ?? "neutral",
  }));

  const groups: BarGroup[] = spendByAd.map((a) => ({
    label: a.ad,
    series: [{ label: "Spend", value: a.spend, tone: "accent" }],
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Spend by channel">
        <Donut segments={segments} centerLabel={currency(total)} />
      </Panel>

      <Panel title="Spend by ad" meta="Top 5">
        <BarChart groups={groups} legend={[{ label: "Spend", tone: "accent" }]} />
      </Panel>
    </div>
  );
}
