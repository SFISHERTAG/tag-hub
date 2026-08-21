import { Panel } from "../../ui";
import { slackConfigured, getRecentMessages } from "@/lib/slack";

function relativeTime(slackTs: string): string {
  const ms = Number(slackTs) * 1000;
  const diffMin = Math.round((Date.now() - ms) / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function NotConfigured({ reason }: { reason: string }) {
  return (
    <Panel title="Slack">
      <p className="text-sm text-ink-3">{reason}</p>
    </Panel>
  );
}

export async function SlackWidget({ channelId }: { channelId?: string }) {
  if (!channelId) {
    return (
      <NotConfigured reason="No Slack channel is linked to this account yet." />
    );
  }

  if (!slackConfigured()) {
    return (
      <NotConfigured reason="Slack isn't connected yet. Set SLACK_BOT_TOKEN to enable this." />
    );
  }

  const feed = await getRecentMessages(channelId);

  if (!feed.ok) {
    return <NotConfigured reason={feed.detail} />;
  }

  if (feed.messages.length === 0) {
    return <NotConfigured reason="No messages yet." />;
  }

  return (
    <Panel title="Slack" meta="Most recent">
      <ul className="max-h-80 space-y-3 overflow-y-auto">
        {feed.messages.map((m) => (
          <li key={m.ts} className="text-sm">
            <div className="flex items-baseline gap-2">
              <span className={`font-medium ${m.isBot ? "text-ink-3" : "text-ink"}`}>
                {m.senderName}
              </span>
              <span className="text-xs text-ink-3">{relativeTime(m.ts)}</span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-ink-2">{m.text}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
