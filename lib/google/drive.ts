import "server-only";
import { google, type drive_v3 } from "googleapis";
import { withErrorHandling, type ApiResult } from "@/lib/api/errorInterceptor";

/**
 * Server-side Google Drive API using domain-wide delegation.
 * Same pattern as gmail.ts — service account signs requests on behalf of the domain.
 */

const SCOPE = "https://www.googleapis.com/auth/drive";
const SERVICE_ACCOUNT =
  process.env.GMAIL_SERVICE_ACCOUNT?.trim() ||
  "hub-app@tag-success-hub.iam.gserviceaccount.com";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
};

/*
 * Built from `google.auth`, deliberately, rather than from a direct
 * `google-auth-library` import.
 *
 * There are two copies of google-auth-library in this tree: the top level one
 * and a nested copy under google-gax, which is the one googleapis types its
 * `auth` option against. The classes are structurally alike but nominally
 * distinct, and both carry `#private` fields, so a value of one is never
 * assignable to the other. That is what the old `as DriveAuth` cast was really
 * papering over.
 *
 * The cast held until google-auth-library 11 added `GdchClient` to the
 * `AnyAuthClient` union returned by `getClient()`. GdchClient overlaps with
 * nothing in the target union, so TypeScript stopped allowing the assertion
 * and the build broke. Constructing through `google.auth` makes the types
 * identical by construction, so no assertion is needed at all. googleapis
 * resolves the client itself.
 */
function getAuth() {
  return new google.auth.GoogleAuth({ scopes: [SCOPE] });
}

/** Maps Drive's API shape onto ours, filling the optionals it leaves out. */
function toDriveFile(file: drive_v3.Schema$File): DriveFile {
  return {
    id: file.id || "",
    name: file.name || "Untitled",
    mimeType: file.mimeType || "application/octet-stream",
    createdTime: file.createdTime || "",
    modifiedTime: file.modifiedTime || "",
    size: file.size ?? undefined,
    webViewLink: file.webViewLink ?? undefined,
    parents: file.parents ?? undefined,
  };
}

/**
 * List files in a Google Drive folder.
 * Returns files with metadata (name, type, dates, size, link).
 */
export async function listDriveFiles(folderId: string): Promise<ApiResult<DriveFile[]>> {
  if (!folderId) return { data: [], error: null };

  return withErrorHandling(`listDriveFiles(${folderId})`, async () => {
    const drive = google.drive({ version: "v3", auth: getAuth() });

    const result = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      spaces: "drive",
      fields:
        "files(id, name, mimeType, createdTime, modifiedTime, size, webViewLink, parents)",
      pageSize: 100,
    });

    return result.data.files?.map(toDriveFile) ?? [];
  });
}

/**
 * Get metadata for a specific file.
 */
export async function getDriveFile(fileId: string): Promise<ApiResult<DriveFile | null>> {
  return withErrorHandling(`getDriveFile(${fileId})`, async () => {
    const drive = google.drive({ version: "v3", auth: getAuth() });

    const file = await drive.files.get({
      fileId,
      fields:
        "id, name, mimeType, createdTime, modifiedTime, size, webViewLink, parents",
    });

    if (!file.data.id) return null;

    return toDriveFile(file.data);
  });
}

/**
 * Determine file category based on MIME type and name.
 */
export function categorizeFile(
  file: DriveFile,
): "guide" | "template" | "report" | "asset" | "other" {
  const name = file.name.toLowerCase();
  const mime = file.mimeType.toLowerCase();

  // By MIME type
  if (mime.includes("pdf")) return "asset";
  if (mime.includes("spreadsheet")) return "report";
  if (mime.includes("document")) return "guide";
  if (mime.includes("image") || mime.includes("video")) return "asset";

  // By name pattern
  if (name.includes("template")) return "template";
  if (name.includes("guide") || name.includes("how")) return "guide";
  if (name.includes("report") || name.includes("analytics")) return "report";

  return "other";
}

/**
 * Get file type icon name.
 */
export function getFileTypeIcon(
  mimeType: string,
): "pdf" | "doc" | "sheet" | "image" | "video" | "folder" {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("spreadsheet")) return "sheet";
  if (mimeType.includes("document")) return "doc";
  if (mimeType.includes("image")) return "image";
  if (mimeType.includes("video")) return "video";
  if (mimeType.includes("folder")) return "folder";
  return "doc";
}

/**
 * Format file size for display.
 */
export function formatFileSize(sizeBytes?: string): string {
  if (!sizeBytes) return "";
  const bytes = parseInt(sizeBytes, 10);
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
