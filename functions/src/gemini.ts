import { GoogleGenAI } from "@google/genai";
import { formatIntakeForPrompt } from "./intake-format";

/**
 * Model used for every onboarding deliverable.
 *
 * One constant rather than four literals — these four generations are one
 * batch producing one document, so they must never drift apart. Changing the
 * model is then a one-line decision with a visible blast radius.
 *
 * `gemini-3.7-flash` is the latest stable Flash. Deliberately not
 * `gemini-3.1-pro-preview`: this runs unattended in a Cloud Function and seeds
 * a client-facing document plus live ad copy, which is the wrong place for a
 * preview model. If output quality warrants Pro later, change it here.
 */
const MODEL = "gemini-3.7-flash";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY || "" });

/**
 * One call path for all four generations.
 *
 * The new SDK returns `response.text` as `string | undefined` — the old
 * `result.response.text()` did not admit that possibility. Undefined here means
 * a safety block, a truncation, or a response carrying no text part, and the
 * caller writes straight into a client-facing Google Doc. Failing loudly beats
 * writing the string "undefined" into it.
 */
async function generate(prompt: string, label: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  const text = response.text;
  if (!text || text.trim().length === 0) {
    throw new Error(`Gemini returned no text for ${label} (model ${MODEL})`);
  }
  return text;
}

/**
 * Generate UVP (Unique Value Proposition) from intake data.
 */
export async function generateUVP(intakeData: Record<string, unknown>): Promise<string> {
  const prompt = `You are a positioning expert for tax advisory firms. Based on this intake data, write a compelling Unique Value Proposition (UVP).

The UVP should:
- Be 2-3 sentences maximum
- Focus on client outcomes (not features)
- Differentiate from competitors
- Resonate with business owners seeking tax advisory

Intake Data:
${formatIntakeForPrompt(intakeData)}

Write ONLY the UVP text, no headers or formatting.`;

  return generate(prompt, "UVP");
}

/**
 * Generate ad/VSL copy variations from intake data.
 */
export async function generateAdCopy(intakeData: Record<string, unknown>): Promise<string> {
  const prompt = `You are a copywriter for a tax advisory acquisition funnel. Write compelling ad/VSL copy based on this intake data.

Create 3 variations of 30-second VSL copy:

**Variation 1: Problem-First**
Start with the problem tax advisors face, then solution.

**Variation 2: Opportunity-First**
Start with the opportunity/gain, then how you deliver it.

**Variation 3: Proof-First**
Start with a result/proof point, then what it means for them.

Each variation should:
- Be exactly 30 seconds when read aloud (~75 words)
- Include a clear CTA (call-to-action)
- Be conversational and authentic

Intake Data:
${formatIntakeForPrompt(intakeData)}

Format each variation clearly with the label and the copy.`;

  return generate(prompt, "ad copy");
}

/**
 * Generate pre-call script for closers.
 */
export async function generatePreCallScript(intakeData: Record<string, unknown>): Promise<string> {
  const prompt = `You are a sales training expert. Write a pre-call script for a closer calling a prospect from this tax advisory firm.

The script should:
- Open with warmth and establish credibility
- Briefly position the opportunity (not the firm)
- Ask qualifying questions about their current situation
- Handle 2-3 common objections
- Close for a meeting or next step
- Be natural and conversational (avoid reading-from-paper feel)

Intake Data:
${formatIntakeForPrompt(intakeData)}

Format as:
**OPENING**
[Script]

**POSITIONING**
[Script]

**QUALIFYING QUESTIONS**
[Questions]

**OBJECTION HANDLING**
- Objection 1: [Handler]
- Objection 2: [Handler]

**CLOSE**
[Script]`;

  return generate(prompt, "pre-call script");
}

/**
 * Generate project charter (timeline, deliverables, milestones).
 */
export async function generateProjectCharter(
  intakeData: Record<string, unknown>
): Promise<string> {

  const prompt = `You are a project manager for a tax advisory acquisition engagement. Write a project charter based on this intake data.

Include:
- Executive Summary (1 paragraph)
- Client Goals (2-3 key goals)
- Deliverables (what will be delivered, when)
- Timeline (phases, milestones, 90-day view minimum)
- Success Metrics (how we'll measure success)
- Roles & Responsibilities (client owner, account manager, closer team)
- Assumptions & Risks

Be specific and actionable. Use dates relative to "Day 1" (e.g., Week 1, Week 2, Month 2).

Intake Data:
${formatIntakeForPrompt(intakeData)}

Format clearly with sections and subsections.`;

  return generate(prompt, "project charter");
}

/**
 * Batch generate all content in parallel.
 */
export async function generateAllContent(intakeData: Record<string, unknown>) {
  const [uvp, adCopy, preCallScript, projectCharter] = await Promise.all([
    generateUVP(intakeData),
    generateAdCopy(intakeData),
    generatePreCallScript(intakeData),
    generateProjectCharter(intakeData),
  ]);

  return {
    uvp,
    adCopy,
    preCallScript,
    projectCharter,
  };
}
