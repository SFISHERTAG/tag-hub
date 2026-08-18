import "server-only";
import { searchContacts, getNotes, type Contact } from "@/lib/ghl/contacts";
import { withErrorHandling, type ApiResult } from "@/lib/api/errorInterceptor";

export interface LeadMetric {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt: Date;
  firstContactAt?: Date;
  speedToLeadMinutes?: number;
  status: "uncontacted" | "contacted" | "qualified" | "lost";
  assignedTo?: string;
  ageMinutes: number;
  priority: "urgent" | "normal" | "aged";
}

export interface SetterMetrics {
  totalLeadsToday: number;
  contactedToday: number;
  contactRate: number;
  averageSpeedMinutes: number;
  pendingCallbacks: number;
  qualifiedLeads: number;
  medianSpeedMinutes: number;
}


export async function getSetterLeads(
  ghlLocationId: string,
  setterEmail?: string,
  daysBack: number = 90
): Promise<ApiResult<LeadMetric[]>> {
  return withErrorHandling(`getSetterLeads(${ghlLocationId})`, async () => {
    // Fetch contacts from GHL
    const contacts = await searchContacts(ghlLocationId, { limit: 500 });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    cutoffDate.setHours(0, 0, 0, 0);

    const recentLeads = contacts.filter((contact) => {
      if (!contact.dateAdded) return false;
      const contactCreated = new Date(contact.dateAdded);
      return contactCreated >= cutoffDate;
    });

    const now = new Date();

    const leads: LeadMetric[] = await Promise.all(
      recentLeads.map(async (contact) => {
        const createdAt = new Date(contact.dateAdded || "");
        const ageMinutes = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60));

        // Fetch notes to determine if contacted
        const notes = await getNotes(ghlLocationId, contact.id).catch(() => []);
        const lastNote = notes[0]; // Notes are sorted newest first
        const lastNoteTime = lastNote?.dateAdded
          ? new Date(lastNote.dateAdded)
          : undefined;

        let speedMinutes: number | undefined;
        if (lastNoteTime) {
          speedMinutes = Math.round(
            (lastNoteTime.getTime() - createdAt.getTime()) / (1000 * 60)
          );
        }

        // Priority: urgent if uncontacted and <2 min old, normal if aged but contacted, aged if >2 min uncontacted
        let priority: "urgent" | "normal" | "aged";
        if (lastNote) {
          priority = "normal"; // Contacted
        } else if (ageMinutes < 2) {
          priority = "urgent"; // Uncontacted and fresh
        } else {
          priority = "aged"; // Uncontacted and old
        }

        return {
          id: contact.id,
          name: contact.contactName ||
                (contact.firstName ? `${contact.firstName} ${contact.lastName || ""}`.trim() : "Unknown"),
          email: contact.email,
          phone: contact.phone,
          createdAt,
          firstContactAt: lastNoteTime,
          speedToLeadMinutes: speedMinutes,
          status: lastNote ? "contacted" : "uncontacted",
          assignedTo: "samuel",
          ageMinutes,
          priority,
        };
      })
    );

    // Sort by priority: urgent first, then normal, then aged
    return leads.sort((a, b) => {
      const priorityOrder = { urgent: 0, normal: 1, aged: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  });
}

export async function getSetterMetrics(
  ghlLocationId: string,
  setterEmail: string
): Promise<ApiResult<SetterMetrics>> {
  const leadsResult = await getSetterLeads(ghlLocationId, setterEmail);
  if (leadsResult.error) return { data: null, error: leadsResult.error };
  const leads = leadsResult.data;

  const contacted = leads.filter((l) => l.firstContactAt);
  const speedTimes = contacted
    .filter((l) => l.speedToLeadMinutes !== undefined)
    .map((l) => l.speedToLeadMinutes as number);

  const contactRate =
    leads.length > 0 ? (contacted.length / leads.length) * 100 : 0;
  const averageSpeed =
    speedTimes.length > 0
      ? Math.round(speedTimes.reduce((a, b) => a + b, 0) / speedTimes.length)
      : 0;
  const medianSpeed =
    speedTimes.length > 0
      ? speedTimes.sort((a, b) => a - b)[Math.floor(speedTimes.length / 2)]
      : 0;

  const qualified = leads.filter((l) => l.status === "qualified");
  const pending = leads.filter((l) => l.status === "uncontacted");

  return {
    data: {
      totalLeadsToday: leads.length,
      contactedToday: contacted.length,
      contactRate: Math.round(contactRate),
      averageSpeedMinutes: averageSpeed,
      pendingCallbacks: pending.length,
      qualifiedLeads: qualified.length,
      medianSpeedMinutes: medianSpeed,
    },
    error: null,
  };
}


