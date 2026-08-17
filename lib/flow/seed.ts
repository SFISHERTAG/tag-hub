import { pool } from "@/lib/postgres";

export async function seedFlowFramework(
  orgId: string,
  createdBy: string
): Promise<string> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create framework
    const frameworkResult = await client.query(
      `INSERT INTO flow_frameworks
      (org_id, name, description, version, is_active, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        orgId,
        "Sales Coaching Framework",
        "Comprehensive call flow framework for triage, diagnostic, sales, and follow-up",
        "1.0.0",
        true,
        createdBy,
        createdBy,
      ]
    );

    const frameworkId = frameworkResult.rows[0].id;

    // Define tabs
    const tabs = [
      {
        label: "Triage",
        icon: "Phone",
        color: "#004AAD",
        sections: [
          {
            label: "Opening",
            cards: [
              {
                key: "opening_frame",
                label: "Opening frame",
                sub: "Frame the call, ask what brought them in",
                content:
                  "Start with credibility. State your name clearly and establish why you're calling. Then ask the prospect what brought them in.",
                why: "The opening frame sets the tone for the entire conversation.",
                notes: "Keep it brief and confident.",
              },
            ],
          },
          {
            label: "Discovery",
            cards: [
              {
                key: "discovery_business",
                label: "Business and situation",
                sub: "What, how long, how going",
                content:
                  "Ask about their business: What do you do? How long have you been doing it? How's it going?",
                why: "Understanding their situation is critical for positioning.",
                notes: "Listen more than you talk.",
              },
              {
                key: "discovery_personal",
                label: "Personal impact",
                sub: "Hours, family, partner support",
                content:
                  "Ask how it impacts them personally: How many hours are you working? How does your family feel about it?",
                why: "People buy emotionally, then justify logically.",
                notes: "Go deep on the personal cost.",
              },
            ],
          },
          {
            label: "Goals and Vision",
            cards: [
              {
                key: "goals_vision",
                label: "Goals and vision casting",
                sub: "Financial target, day-in-the-life, current path",
                content:
                  "Paint a picture: What's your financial target? What does your ideal day look like? Where do you see yourself in 5 years?",
                why: "Most people are running from pain. You need to help them run toward a vision.",
                notes: "Make the vision tangible and compelling.",
              },
            ],
          },
          {
            label: "Recap",
            cards: [
              {
                key: "recap",
                label: "The recap",
                sub: "Mirror exact words; situation, attempts, vision",
                content:
                  "Recap: So what I'm hearing is... [situation]. You've tried... [attempts]. And your vision is... [vision]. Is that right?",
                why: "The recap shows you're listening and creates agreement.",
                notes: "Use their exact language.",
              },
            ],
          },
          {
            label: "Transition",
            cards: [
              {
                key: "permission_identity",
                label: "Permission + identity match",
                sub: "Are you open to honest feedback?",
                content:
                  "Ask permission: Are you open to some honest feedback? Then establish identity: People like us typically...",
                why: "Permission softens resistance. Identity creates trust.",
                notes: "This is the bridge from discovery to recommendation.",
              },
            ],
          },
        ],
      },
      {
        label: "Diagnostic",
        icon: "FileSearch",
        color: "#ADC8E3",
        sections: [
          {
            label: "Situation Assessment",
            cards: [
              {
                key: "diagnostic_intro",
                label: "Diagnostic introduction",
                sub: "Position the questions",
                content:
                  "I have some diagnostic questions to better understand where you are. These aren't tests—they're just to help me understand your situation better.",
                why: "Framing makes the questions feel like help, not interrogation.",
                notes: "Stay curious, not judgy.",
              },
            ],
          },
        ],
      },
      {
        label: "Sales",
        icon: "BookOpen",
        color: "#ADC8E3",
        sections: [
          {
            label: "Opening",
            cards: [
              {
                key: "sales_opening",
                label: "Sales opening",
                sub: "Transition to the pitch",
                content:
                  "Based on everything you've told me, here's what I think could work...",
                why: "The opening of your sales pitch builds on the discovery you've done.",
                notes: "Reference their specific situation.",
              },
            ],
          },
          {
            label: "Pitch",
            cards: [
              {
                key: "pitch_core",
                label: "Core pitch",
                sub: "What you offer and why",
                content:
                  "We help [audience] get [outcome] so that [transformation]. Here's how: [mechanism]. Timeline: [timeframe]. Investment: [price].",
                why: "A clear structure makes your pitch memorable and persuasive.",
                notes: "Make it about them, not about you.",
              },
            ],
          },
          {
            label: "Close",
            cards: [
              {
                key: "close_assumptive",
                label: "Assumptive close",
                sub: "Ask for the sale",
                content: "So, next steps would be... Does Tuesday or Wednesday work better for onboarding?",
                why: "Assumptive closes bypass objections and move to logistics.",
                notes: "Never ask yes/no. Ask which, when, how.",
              },
            ],
          },
        ],
      },
      {
        label: "Follow-Up",
        icon: "Reply",
        color: "#a78bfa",
        sections: [
          {
            label: "After Call",
            cards: [
              {
                key: "followup_recap",
                label: "Follow-up recap",
                sub: "Send within 1 hour",
                content:
                  "Subject: Quick recap from our call today\n\nHi [Name],\n\nGreat talking with you today. Here's what we discussed:\n\n[Recap]\n\nNext: [Next steps]\n\nLooking forward to [specific outcome].",
                why: "The follow-up email converts tire-kickers to buyers.",
                notes: "Personalize. Reference specific things they said.",
              },
            ],
          },
        ],
      },
    ];

    // Insert tabs, sections, cards, and scripts
    for (const tab of tabs) {
      const tabResult = await client.query(
        `INSERT INTO flow_tabs
        (framework_id, label, icon, color, display_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id`,
        [frameworkId, tab.label, tab.icon, tab.color, 0, true]
      );

      const tabId = tabResult.rows[0].id;

      for (const section of tab.sections) {
        const sectionResult = await client.query(
          `INSERT INTO flow_sections
          (tab_id, label, description, display_order, is_active)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id`,
          [tabId, section.label, null, 0, true]
        );

        const sectionId = sectionResult.rows[0].id;

        for (const card of section.cards) {
          const cardResult = await client.query(
            `INSERT INTO flow_cards
            (section_id, key, label, sub_label, display_order, is_active)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id`,
            [sectionId, card.key, card.label, card.sub, 0, true]
          );

          const cardId = cardResult.rows[0].id;

          // Insert script for this card
          await client.query(
            `INSERT INTO flow_scripts
            (card_id, content, why, notes, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              cardId,
              card.content,
              card.why,
              card.notes,
              createdBy,
              createdBy,
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    return frameworkId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
