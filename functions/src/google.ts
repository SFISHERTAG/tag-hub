import { google, type docs_v1 } from "googleapis";

/**
 * Get authenticated Google API clients using keyless delegation.
 * Uses ADC (Application Default Credentials) and domain-wide delegation.
 */
function getGoogleAuth() {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents",
    ],
  });
  return auth;
}

/**
 * Create a Drive folder in a Shared Drive.
 * Returns the folder ID.
 */
export async function createDriveFolder(
  sharedDriveId: string,
  folderName: string
): Promise<string> {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [sharedDriveId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  if (!response.data.id) {
    throw new Error("Failed to create Drive folder");
  }

  return response.data.id;
}

/**
 * Create a Google Doc in a Drive folder.
 * Returns the document ID.
 */
export async function createGoogleDoc(
  folderIdId: string,
  title: string,
  initialContent?: string
): Promise<string> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  // Create the doc
  const docResponse = await docs.documents.create({
    requestBody: {
      title,
    },
  });

  const docId = docResponse.data.documentId;
  if (!docId) {
    throw new Error("Failed to create Google Doc");
  }

  // Move to folder
  await drive.files.update({
    fileId: docId,
    addParents: folderIdId,
    fields: "id, parents",
    supportsAllDrives: true,
  });

  // Add initial content if provided
  if (initialContent) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            insertText: {
              text: initialContent,
              location: {
                index: 1,
              },
            },
          },
        ],
      },
    });
  }

  return docId;
}

/**
 * The character index just past the last character of a document's body.
 *
 * `body.content` is an array of structural elements, so `content.length` is a
 * count of paragraphs and tables, not a character offset — usually 2 or 3 for
 * a fresh doc. Both append paths used it as an index, so every "append"
 * inserted a couple of characters into the top of the document instead of at
 * the end, and successive appends interleaved there in reverse. That is what
 * garbled every Phase 2 onboarding doc.
 *
 * Google Docs rejects an insert at the body's own `endIndex` (that position
 * belongs to the trailing newline the API owns), so the last valid insertion
 * point is one before it.
 */
function endOfBodyIndex(doc: docs_v1.Schema$Document): number {
  const content = doc.body?.content;
  if (!content || content.length === 0) return 1;

  const lastEnd = content[content.length - 1]?.endIndex;
  if (typeof lastEnd !== "number" || lastEnd < 2) return 1;

  return lastEnd - 1;
}

/**
 * Append text to a Google Doc (at the end).
 */
export async function appendToGoogleDoc(
  docId: string,
  text: string
): Promise<void> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: "v1", auth });

  const doc = await docs.documents.get({ documentId: docId });
  const endIndex = endOfBodyIndex(doc.data);

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            text: `\n\n${text}`,
            location: {
              index: endIndex,
            },
          },
        },
      ],
    },
  });
}

/**
 * Add a tab (named range) to a Google Doc.
 * This is a simplified version — full tab support is more complex.
 */
export async function addDocTab(
  docId: string,
  tabTitle: string,
  content: string
): Promise<void> {
  const auth = getGoogleAuth();
  const docs = google.docs({ version: "v1", auth });

  // Add content with a heading to simulate a tab
  const doc = await docs.documents.get({ documentId: docId });
  const endIndex = endOfBodyIndex(doc.data);

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            text: `\n\n${tabTitle}\n`,
            location: {
              index: endIndex,
            },
          },
        },
        {
          updateTextStyle: {
            range: {
              startIndex: endIndex,
              endIndex: endIndex + tabTitle.length + 2,
            },
            textStyle: {
              bold: true,
              fontSize: {
                magnitude: 14,
                unit: "PT",
              },
            },
            fields: "bold,fontSize",
          },
        },
        {
          insertText: {
            text: `${content}\n`,
            location: {
              index: endIndex + tabTitle.length + 3,
            },
          },
        },
      ],
    },
  });
}

/**
 * Make a Google Doc readable by a user via email.
 */
export async function shareGoogleDoc(
  docId: string,
  userEmail: string,
  role: "reader" | "writer" = "reader"
): Promise<void> {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  await drive.permissions.create({
    fileId: docId,
    requestBody: {
      role,
      type: "user",
      emailAddress: userEmail,
    },
    supportsAllDrives: true,
  });
}
