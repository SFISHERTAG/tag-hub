"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "../../ui";

/**
 * Upload happens as the visitor's own Google identity, not TAG's.
 *
 * The folder is already shared with the client's Google account outside this
 * app — that sharing is what grants access, same as it would opening Drive
 * directly. This widget only needs the narrow `drive.file` scope: Picker
 * grants per-item access at the moment something is picked or created
 * through it, so a file uploaded here becomes reachable to this app without
 * the app ever being able to see anything else already in that Drive. No
 * server-side Drive credential is needed for any of this — the browser talks
 * to Google directly.
 */

const SCOPE = "https://www.googleapis.com/auth/drive.file";

type TokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
};

type TokenResponse = { access_token?: string; error?: string };

type PickerBuilder = {
  addView: (view: unknown) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setCallback: (cb: (data: { action: string }) => void) => PickerBuilder;
  build: () => { setVisible: (v: boolean) => void };
};

type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (resp: TokenResponse) => void;
      }) => TokenClient;
    };
  };
  picker: {
    DocsUploadView: new () => { setParentFolder: (id: string) => unknown };
    PickerBuilder: new () => PickerBuilder;
    Action: { PICKED: string; CANCEL: string };
  };
};

declare global {
  interface Window {
    google?: GoogleGlobal;
    gapi?: { load: (api: string, cb: () => void) => void };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

type Status = "idle" | "loading" | "ready" | "uploading" | "uploaded" | "error";

export function DocumentsWidget({ folderId }: { folderId?: string }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_PICKER_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
  const uploadConfigured = Boolean(clientId && apiKey && folderId);

  // Known synchronously from env vars and props, not from anything the effect
  // discovers — so "loading" is the initial state itself rather than a
  // setState call the effect makes on mount.
  const [status, setStatus] = useState<Status>(uploadConfigured ? "loading" : "idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const tokenClientRef = useRef<TokenClient | null>(null);

  function openPicker(accessToken: string) {
    const google = window.google!;
    const view = new google.picker.DocsUploadView().setParentFolder(folderId!);

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey!)
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          setStatus("uploaded");
        }
      })
      .build();

    picker.setVisible(true);
  }

  useEffect(() => {
    if (!uploadConfigured) return;

    let cancelled = false;

    Promise.all([
      loadScript("https://accounts.google.com/gsi/client"),
      loadScript("https://apis.google.com/js/api.js"),
    ])
      .then(
        () =>
          new Promise<void>((resolve) => window.gapi!.load("picker", () => resolve())),
      )
      .then(() => {
        if (cancelled) return;
        tokenClientRef.current = window.google!.accounts.oauth2.initTokenClient({
          client_id: clientId!,
          scope: SCOPE,
          callback: (resp) => {
            if (resp.error || !resp.access_token) {
              setStatus("error");
              setErrorMessage("Google declined the upload permission request.");
              return;
            }
            openPicker(resp.access_token);
          },
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("Could not load Google's upload tools.");
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- script loading is a one-time effect keyed by whether upload is configured at all, not by values that change after mount
  }, [uploadConfigured]);

  function handleUploadClick() {
    if (!tokenClientRef.current) return;
    setStatus("uploading");
    tokenClientRef.current.requestAccessToken();
  }

  if (!folderId) {
    return (
      <Panel title="Documents">
        <p className="text-sm text-ink-3">
          No document folder is linked to this account yet.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Documents"
      meta={
        uploadConfigured ? (
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={status === "loading" || status === "uploading"}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-60"
          >
            {status === "uploading" ? "Uploading…" : "Upload"}
          </button>
        ) : undefined
      }
    >
      {status === "uploaded" && (
        <p className="mb-3 text-xs text-ok">
          Uploaded — it may take a moment to appear below.
        </p>
      )}
      {status === "error" && errorMessage && (
        <p className="mb-3 text-xs text-danger">{errorMessage}</p>
      )}
      {!uploadConfigured && (
        <p className="mb-3 text-xs text-ink-3">
          In-Hub upload isn&rsquo;t configured yet — browsing still works below.
        </p>
      )}

      <iframe
        src={`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#grid`}
        className="h-64 w-full rounded-md border border-line"
        title="Client documents"
      />
    </Panel>
  );
}
