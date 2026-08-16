import { Request, Response } from "express";
import { handlePhase1 } from "./webhooks/phase1-provisioning";
import { handlePhase2 } from "./webhooks/phase2-intake-submit";
import { handlePhase3 } from "./webhooks/phase3-meta-setup";

/**
 * Export handlers directly for Cloud Functions deployment.
 * Each function becomes an HTTP-triggered Cloud Function.
 */

/**
 * Phase 1: GHL webhook (checkbox checked + Closed Won stage)
 * Expected webhook body:
 * {
 *   "opportunity": { "id": "...", "name": "...", "stage": "Closed Won" },
 *   "contact": { "id": "...", "name": "...", "email": "..." },
 *   "customField_initiateOnboarding": true
 * }
 */
export async function phase1Provisioning(req: Request, res: Response) {
  return handlePhase1(req, res);
}

/**
 * Phase 2: Intake form submission
 * Expected body:
 * {
 *   "locationId": "...",
 *   "email": "...",
 *   "intakeData": { "businessName": "...", ... }
 * }
 */
export async function phase2IntakeSubmit(req: Request, res: Response) {
  return handlePhase2(req, res);
}

/**
 * Phase 3: Meta ad account setup
 * Expected body:
 * {
 *   "locationId": "...",
 *   "email": "...",
 *   "intakeData": { "metaAdAccountId": "...", ... },
 *   "slackChannelId": "..."
 * }
 */
export async function phase3MetaSetup(req: Request, res: Response) {
  return handlePhase3(req, res);
}

// For local testing with Express
import express, { Express } from "express";

const app: Express = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// Health check
app.get("/", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "TAG Automation Functions",
    endpoints: [
      "POST /webhook/phase1 - GHL checkbox + Closed Won → provision resources",
      "POST /webhook/phase2 - Intake form submit → create doc",
      "POST /webhook/phase3 - Phase 2 complete → setup Meta ad account",
    ],
  });
});

// Phase 1 route
app.post("/webhook/phase1", phase1Provisioning);

// Phase 2 route
app.post("/webhook/phase2", phase2IntakeSubmit);

// Phase 3 route
app.post("/webhook/phase3", phase3MetaSetup);

// Error handling
app.use((err: Error, req: Request, res: Response) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server (for local dev)
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`[Server] Listening on port ${port}`);
  });
}

export default app;
