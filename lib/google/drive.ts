import "server-only";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

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

async function getAuthClient() {
  const auth = new GoogleAuth({
    scopes: [SCOPE],
  });
  return auth.getClient();
}

/**
 * List files in a Google Drive folder.
 * Returns files with metadata (name, type, dates, size, link).
 */
export async function listDriveFiles(folderId: string): Promise<DriveFile[]> {
  if (!folderId) return [];

  try {
    const auth = await getAuthClient();
    const drive = google.drive({ version: "v3", auth: auth as any });

    const result = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      spaces: "drive",
      fields:
        "files(id, name, mimeType, createdTime, modifiedTime, size, webViewLink, parents)",
      pageSize: 100,
    });

    return (
      result.data.files?.map((file: any) => ({
        id: file.id || "",
        name: file.name || "Untitled",
        mimeType: file.mimeType || "application/octet-stream",
        createdTime: file.createdTime || "",
        modifiedTime: file.modifiedTime || "",
        size: file.size,
        webViewLink: file.webViewLink,
        parents: file.parents,
      })) || []
    );
  } catch (error) {
    console.error("Error listing Drive files:", error);
    return [];
  }
}

/**
 * Get metadata for a specific file.
 */
export async function getDriveFile(fileId: string): Promise<DriveFile | null> {
  try {
    const auth = await getAuthClient();
    const drive = google.drive({ version: "v3", auth: auth as any });

    const file = await drive.files.get({
      fileId,
      fields:
        "id, name, mimeType, createdTime, modifiedTime, size, webViewLink, parents",
    });

    if (!file.data.id) return null;

    return {
      id: file.data.id,
      name: (file.data as any).name || "Untitled",
      mimeType: file.data.mimeType || "application/octet-stream",
      createdTime: (file.data as any).createdTime || "",
      modifiedTime: (file.data as any).modifiedTime || "",
      size: (file.data as any).size,
      webViewLink: file.data.webViewLink || undefined,
      parents: (file.data as any).parents as string[] | undefined,
    };
  } catch (error) {
    console.error("Error getting Drive file:", error);
    return null;
  }
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
