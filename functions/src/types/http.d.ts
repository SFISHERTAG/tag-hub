// Ambient module augmentation, no import/export needed for it to apply
// globally within this project's compilation.
declare module "http" {
  interface IncomingMessage {
    /**
     * Raw request body bytes. Populated by express.json's `verify` hook in
     * index.ts for local/dev, and automatically by the Cloud Functions
     * Framework buildpack for deployed HTTP functions. HMAC signature
     * verification (see webhooks/signature.ts) must run over these exact
     * bytes, never over JSON.stringify(req.body) - re-serializing a parsed
     * object is not guaranteed to match what the sender signed (key order,
     * whitespace).
     *
     * Declared on http.IncomingMessage rather than express.Request because
     * that is the type express.json's `verify` callback actually receives,
     * and express.Request extends http.IncomingMessage, so the field is
     * visible on both.
     */
    rawBody?: Buffer;
  }
}
