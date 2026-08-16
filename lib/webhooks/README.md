# Webhook reliability

Three small modules, composed by whoever builds the first webhook receiver.
Not wired to a route yet — Tag Hub currently polls GHL rather than receiving
webhooks from it. Ported from CCE's Secure Webhook Hub pattern.

- `signature.ts` — HMAC-SHA256 verification, timing-safe.
- `idempotency.ts` — has this event id been handled before?
- `deadLetterQueue.ts` — where a failed event lands, plus manual-review flagging.

## Intended shape of a route handler

```ts
// app/api/webhooks/[source]/route.ts (illustrative — not built)
import { verifyHmacSignature } from "@/lib/webhooks/signature";
import { hasBeenProcessed, markProcessed } from "@/lib/webhooks/idempotency";
import { recordFailure } from "@/lib/webhooks/deadLetterQueue";

export async function POST(req: Request) {
  const rawBody = await req.text(); // read as text BEFORE parsing — signatures are computed over raw bytes
  const signature = req.headers.get("x-signature");

  if (!verifyHmacSignature(rawBody, signature, process.env.WEBHOOK_SECRET!)) {
    await recordFailure({ source: "ghl", reason: "invalid_signature", payload: rawBody });
    return new Response("invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (await hasBeenProcessed("ghl", event.id)) {
    return new Response("ok", { status: 200 }); // already handled, not an error
  }

  try {
    await handleEvent(event); // whatever this event actually does
    await markProcessed("ghl", event.id);
  } catch (err) {
    await recordFailure({
      source: "ghl",
      reason: "handler_error",
      payload: event,
      error: err instanceof Error ? err.message : String(err),
    });
    return new Response("handler failed, recorded for review", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
```

## Firestore collections

- `webhookEventsProcessed/{source}:{eventId}` — idempotency markers.
- `webhookDeadLetter/{id}` — failed events, with `flagged` / `resolved` state.

## Testing note

`signature.ts` is pure logic and has a real unit test (`signature.test.ts`).
`idempotency.ts` and `deadLetterQueue.ts` need a live Firestore connection —
no credentials are available in this environment to integration-test them
here. They're type-checked and follow the exact same `firestore()` client as
every other module in this app, but the first real webhook receiver should
exercise them against a real (or emulated) Firestore before shipping.
