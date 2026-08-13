/**
 * Slack integration for provisioning channels.
 * Uses bot token with channels:manage, conversations:create scopes.
 */

export async function slackCall<T>(
  method: string,
  body?: unknown
): Promise<T> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");

  const response = await fetch("https://slack.com/api/" + method, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as Record<string, unknown>;
  if (!data.ok) {
    throw new Error(`Slack ${method} failed: ${data.error}`);
  }

  return data as T;
}

/**
 * Create a Slack channel for a client (single-channel guest pattern).
 * Returns the channel ID.
 */
export async function createSlackChannel(clientName: string): Promise<string> {
  // Replace spaces with hyphens, lowercase, remove special chars
  const channelName = clientName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80);

  interface CreateChannelResponse {
    channel: {
      id: string;
      name: string;
    };
  }

  const result = await slackCall<CreateChannelResponse>("conversations.create", {
    name: channelName,
    is_private: false,
    topic: {
      value: `Client: ${clientName}`,
    },
  });

  return result.channel.id;
}

/**
 * Invite client as single-channel guest to the channel.
 * Requires their email and Slack workspace setup for single-channel guests.
 */
export async function inviteSlackGuest(
  channelId: string,
  clientEmail: string
): Promise<void> {
  interface InviteResponse {
    user: {
      id: string;
    };
  }

  const result = await slackCall<InviteResponse>("admin.users.invite", {
    email: clientEmail,
    channel_ids: [channelId],
    mode: "single_channel",
  });

  if (!result.user?.id) {
    throw new Error(`Failed to invite ${clientEmail} to Slack`);
  }
}

/**
 * Post a message to a channel (useful for onboarding instructions).
 */
export async function postMessage(
  channelId: string,
  text: string,
  blocks?: unknown[]
): Promise<void> {
  await slackCall("chat.postMessage", {
    channel: channelId,
    text,
    blocks,
  });
}
