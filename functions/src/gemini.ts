import { GoogleGenerativeAI } from "@google/generative-ai";
import { formatIntakeForPrompt } from "./intake-format";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

/**
 * Generate UVP (Unique Value Proposition) from intake data.
 */
export async function generateUVP(intakeData: Record<string, unknown>): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are a positioning expert for tax advisory firms. Based on this intake data, write a compelling Unique Value Proposition (UVP).

The UVP should:
- Be 2-3 sentences maximum
- Focus on client outcomes (not features)
- Differentiate from competitors
- Resonate with business owners seeking tax advisory

Intake Data:
${formatIntakeForPrompt(intakeData)}

Write ONLY the UVP text, no headers or formatting.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Generate ad/VSL copy variations from intake data.
 */
export async function generateAdCopy(intakeData: Record<string, unknown>): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Generate pre-call script for closers.
 */
export async function generatePreCallScript(intakeData: Record<string, unknown>): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Generate project charter (timeline, deliverables, milestones).
 */
export async function generateProjectCharter(
  intakeData: Record<string, unknown>
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

  const result = await model.generateContent(prompt);
  return result.response.text();
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
