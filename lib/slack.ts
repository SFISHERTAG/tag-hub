import "server-only";

/**
 * Read-only Slack channel history for the client-owner dashboard's "cubby".
 *
 * Deliberately narrow: this fetches recent messages for display, nothing
 * more. It does not compute awaiting-reply or response-time signals — those
 * are Epic 9's own stories (9.3/9.4), a different feature with its own
 * Firestore-persisted timestamps, not something to grow out of a widget that
 * exists to answer "what's the latest in my channel" at a glance.
 *
 * The channel id this fetches is never accepted from the client — every
 * caller resolves it server-side from the session's own location
 * (lib/dashboard/location-config.ts). That is what makes showing message
 * content here different from Epic 9.5's staff-only restriction: a
 * client_owner is a single-channel guest with no other Slack access to begin
 * with, so this widget can only ever show a channel that visitor could already
 * read by opening Slack itself. The risk 9.5 exists for — a channel id
 * accepted from a request letting one client read another client's
 * conversation — has no surface here because there is no parameter to forge.
 */

const SLACK_API = "https://slack.com/api";

export function slackConfigured(): boolean {
  return Boolean(process.env.SLACK_BOT_TOKEN?.trim());
}

function token(): string {
  const t = process.env.SLACK_BOT_TOKEN?.trim();
  if (!t) throw new Error("SLACK_BOT_TOKEN is not set.");
  return t;
}

export type SlackMessage = {
  ts: string;
  text: string;
  senderName: string;
  isBot: boolean;
};

export type SlackChannelFeed =
  | { ok: true; messages: SlackMessage[] }
  | { ok: false; reason: "not_in_channel" | "channel_not_found" | "error"; detail: string };

async function slackCall<T>(
  method: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${SLACK_API}/${method}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}` },
    // Slack messages are exactly the kind of thing that must never be
    // served stale from a shared cache.
    cache: "no-store",
  });
  return response.json() as Promise<T>;
}

type HistoryResponse = {
  ok: boolean;
  error?: string;
  messages?: {
    ts: string;
    text?: string;
    user?: string;
    bot_id?: string;
    username?: string;
    subtype?: string;
  }[];
};

type UserInfoResponse = {
  ok: boolean;
  user?: { real_name?: string; profile?: { display_name?: string } };
};

/** Slack user IDs are stable and small in number per channel — resolve each once, not per message. */
async function resolveSenderNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  const names = new Map<string, string>();

  await Promise.all(
    unique.map(async (id) => {
      try {
        const info = await slackCall<UserInfoResponse>("users.info", { user: id });
        const name =
          info.user?.profile?.display_name || info.user?.real_name || "Someone";
        names.set(id, name);
      } catch {
        names.set(id, "Someone");
      }
    }),
  );

  return names;
}

export async function getRecentMessages(
  channelId: string,
  limit = 12,
): Promise<SlackChannelFeed> {
  const history = await slackCall<HistoryResponse>("conversations.history", {
    channel: channelId,
    limit: String(limit),
  });

  if (!history.ok) {
    if (history.error === "not_in_channel") {
      return {
        ok: false,
        reason: "not_in_channel",
        detail: "The bot has not been invited to this channel yet.",
      };
    }
    if (history.error === "channel_not_found") {
      return {
        ok: false,
        reason: "channel_not_found",
        detail: "That channel id no longer resolves — check locations/{id}.slackChannelId.",
      };
    }
    return { ok: false, reason: "error", detail: history.error ?? "Unknown Slack error." };
  }

  const raw = (history.messages ?? []).filter((m) => !m.subtype);
  const userIds = raw.filter((m) => m.user).map((m) => m.user!);
  const names = await resolveSenderNames(userIds);

  const messages: SlackMessage[] = raw.map((m) => ({
    ts: m.ts,
    text: m.text ?? "",
    isBot: Boolean(m.bot_id),
    senderName: m.bot_id
      ? (m.username ?? "Bot")
      : (m.user && names.get(m.user)) || "Someone",
  }));

  // Slack returns newest-first; a chat reads top-to-bottom oldest-first.
  messages.reverse();

  return { ok: true, messages };
}

/**
 * Canvases for the dashboard's "Open Canvas" links.
 *
 * Deliberately just links out, not an embed — Slack has no public API to
 * render a canvas's live content outside Slack's own client, so building
 * toward an in-Hub canvas view isn't possible against the documented Web API
 * today. `properties.tabs` is confirmed live (not just documented) to be the
 * canonical list of a channel's canvases; `properties.meeting_notes` and
 * `properties.tabz` both turned out to duplicate an entry already in `tabs`
 * rather than naming anything additional, so neither is read here.
 */

export type ChannelCanvas = {
  fileId: string;
  title: string;
  permalink: string;
};

type ConversationsInfoResponse = {
  ok: boolean;
  error?: string;
  channel?: {
    properties?: {
      tabs?: { type: string; data?: { file_id?: string } }[];
    };
  };
};

type FilesInfoResponse = {
  ok: boolean;
  error?: string;
  file?: { title?: string; name?: string; permalink?: string };
};

export async function getChannelCanvases(
  channelId: string,
): Promise<ChannelCanvas[]> {
  const info = await slackCall<ConversationsInfoResponse>(
    "conversations.info",
    { channel: channelId },
  );
  if (!info.ok) return [];

  const fileIds = (info.channel?.properties?.tabs ?? [])
    .filter((t) => t.type === "canvas" && t.data?.file_id)
    .map((t) => t.data!.file_id!);

  const canvases = await Promise.all(
    fileIds.map(async (fileId): Promise<ChannelCanvas | null> => {
      const files = await slackCall<FilesInfoResponse>("files.info", {
        file: fileId,
      });
      if (!files.ok || !files.file?.permalink) return null;
      return {
        fileId,
        // A freshly created, still-empty canvas has no title until someone
        // names it in Slack — "Untitled" is Slack's own value for that case,
        // confirmed live via conversations.canvases.create, not a fallback
        // invented here.
        title: files.file.title || files.file.name || "Untitled",
        permalink: files.file.permalink,
      };
    }),
  );

  return canvases.filter((c): c is ChannelCanvas => c !== null);
}

/**
 * Creates a channel canvas seeded with markdown content — for Task #3's
 * client-onboarding automation, not the dashboard widget (which only reads).
 * Confirmed live: the new canvas's title starts as "Untitled" regardless of
 * the markdown body's own heading — set a title afterward with `canvases.edit`
 * if the provisioning flow needs one, rather than assuming the heading does it.
 */
export async function createChannelCanvas(
  channelId: string,
  markdown: string,
): Promise<{ canvasId: string }> {
  const response = await fetch(`${SLACK_API}/conversations.canvases.create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel_id: channelId,
      document_content: { type: "markdown", markdown },
    }),
  });

  const data = (await response.json()) as { ok: boolean; canvas_id?: string; error?: string };
  if (!data.ok || !data.canvas_id) {
    throw new Error(`Slack canvas creation failed: ${data.error ?? "unknown error"}`);
  }

  return { canvasId: data.canvas_id };
}
