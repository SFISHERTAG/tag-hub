import "server-only";
import { DEFAULT_TIME_ZONE } from "../time/zone";
import { getAppointments, dayRange, formatTime, type Appointment } from "@/lib/ghl/appointments";
import { listDriveFiles, categorizeFile, getFileTypeIcon, formatFileSize, type DriveFile } from "@/lib/google/drive";
import { getLocationConfig } from "./location-config";
import { type ApiResult } from "@/lib/api/errorInterceptor";

/**
 * Server-side data fetchers for dashboard screens.
 * Combines GHL API, Google Drive API, and Firestore config.
 */

export type CreativeForDisplay = {
  id: string;
  title: string;
  platform: "facebook" | "instagram" | "google" | "tiktok" | "meta" | "other";
  format: "image" | "video" | "carousel" | "text" | "document";
  status: "draft" | "pending-approval" | "approved" | "rejected";
  thumbnail?: string;
  description?: string;
  submittedAt: string;
  fileId?: string;
  webViewLink?: string;
};

export type CallForDisplay = {
  id: string;
  startTime: string;
  endTime: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
  booked: boolean;
  attendee?: string;
  topic?: string;
  callType: "discovery" | "strategy" | "optimization" | "follow-up" | "other";
  status: "new" | "confirmed" | "showed" | "noshow" | "cancelled" | "invalid";
  contactId?: string;
  assignedUserId?: string;
};

export type ResourceForDisplay = {
  id: string;
  name: string;
  type: "pdf" | "doc" | "sheet" | "image" | "video" | "folder";
  size?: string;
  modifiedAt: string;
  sharedWith?: string[];
  category: "guide" | "template" | "report" | "asset" | "other";
  webViewLink?: string;
};

/**
 * Map GHL appointment to call display format.
 */
function mapAppointmentToCall(apt: Appointment): CallForDisplay {
  const typeMap: Record<string, CallForDisplay["callType"]> = {
    discovery: "discovery",
    strategy: "strategy",
    optimization: "optimization",
    "follow-up": "follow-up",
  };

  const callType = typeMap[apt.title?.toLowerCase() || ""] || "other";

  return {
    id: apt.id,
    startTime: apt.startTime,
    endTime: apt.endTime,
    startTimeFormatted: formatTime(apt.startTime),
    endTimeFormatted: formatTime(apt.endTime),
    booked: true,
    attendee: apt.title,
    topic: apt.notes,
    callType,
    status: apt.status,
    contactId: apt.contactId,
    assignedUserId: apt.assignedUserId,
  };
}

/**
 * Map Google Drive file to creative display format.
 * Infers platform and status from filename/metadata.
 */
function mapDriveFileToCreative(file: DriveFile): CreativeForDisplay {
  const name = file.name.toLowerCase();

  // Infer platform from filename
  const platformMap: Record<string, CreativeForDisplay["platform"]> = {
    facebook: "facebook",
    fb: "facebook",
    instagram: "instagram",
    ig: "instagram",
    tiktok: "tiktok",
    tt: "tiktok",
    google: "google",
    meta: "meta",
  };

  let platform: CreativeForDisplay["platform"] = "other";
  for (const [key, value] of Object.entries(platformMap)) {
    if (name.includes(key)) {
      platform = value;
      break;
    }
  }

  // Infer format from MIME type
  const format: CreativeForDisplay["format"] = file.mimeType.includes("video")
    ? "video"
    : file.mimeType.includes("image")
      ? "image"
      : "document";

  // Infer status from filename
  const statusMap: Record<string, CreativeForDisplay["status"]> = {
    draft: "draft",
    pending: "pending-approval",
    approved: "approved",
    rejected: "rejected",
  };

  let status: CreativeForDisplay["status"] = "draft";
  for (const [key, value] of Object.entries(statusMap)) {
    if (name.includes(key)) {
      status = value;
      break;
    }
  }

  return {
    id: file.id,
    title: file.name,
    platform,
    format,
    status,
    submittedAt: file.createdTime || new Date().toISOString(),
    fileId: file.id,
    webViewLink: file.webViewLink,
    description: `Modified ${new Date(file.modifiedTime).toLocaleDateString("en-US", { timeZone: DEFAULT_TIME_ZONE })}`,
  };
}

/**
 * Map Google Drive file to resource display format.
 */
function mapDriveFileToResource(file: DriveFile): ResourceForDisplay {
  return {
    id: file.id,
    name: file.name,
    type: getFileTypeIcon(file.mimeType),
    size: formatFileSize(file.size),
    modifiedAt: file.modifiedTime,
    category: categorizeFile(file),
    webViewLink: file.webViewLink,
    sharedWith: [],
  };
}

/**
 * Fetch calls (appointments) for a given day and location.
 */
export async function fetchCalls(
  locationId: string,
  offsetDays: number = 0,
): Promise<CallForDisplay[]> {
  const range = dayRange(offsetDays);
  const appointments = await getAppointments(locationId, range);
  return appointments.map(mapAppointmentToCall);
}

/**
 * Fetch creatives (files) from a location's Cubby folder.
 */
export async function fetchCreatives(locationId: string): Promise<ApiResult<CreativeForDisplay[]>> {
  const config = await getLocationConfig(locationId);
  if (!config.driveFolderId) return { data: [], error: null };

  const result = await listDriveFiles(config.driveFolderId);
  if (result.error) return { data: null, error: result.error };
  return {
    data: result.data.filter((f) => !f.mimeType.includes("folder")).map(mapDriveFileToCreative),
    error: null,
  };
}

/**
 * Fetch resources (documents) from a location's folder.
 */
export async function fetchResources(locationId: string): Promise<ApiResult<ResourceForDisplay[]>> {
  const config = await getLocationConfig(locationId);
  if (!config.driveFolderId) return { data: [], error: null };

  const result = await listDriveFiles(config.driveFolderId);
  if (result.error) return { data: null, error: result.error };
  return { data: result.data.map(mapDriveFileToResource), error: null };
}

/**
 * Fetch calls for next 7 days.
 */
export async function fetchUpcomingCalls(locationId: string, days: number = 7): Promise<CallForDisplay[]> {
  const allCalls: CallForDisplay[] = [];

  for (let i = 0; i < days; i++) {
    const calls = await fetchCalls(locationId, i);
    allCalls.push(...calls);
  }

  return allCalls;
}
