import { useCallback, useEffect, useState } from "react";
import {
  fetchCredentials, setCredential, removeCredential, isDesktop,
  type CredentialStatus,
} from "../lib/api.ts";

/**
 * Keys go in; they never come back out.
 *
 * The panel can see *that* a credential is stored and can replace or delete it.
 * There is no read path — the bridge exposes no `get`, the main process decrypts
 * only when spawning the backend, and the value never enters this process's memory.
 */
export default function CredentialsPanel() {

  const [credentials, setCredentials] = useState<CredentialStatus[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isDesktop) return;
    try {
      const result = await fetchCredentials();
      setCredentials(result.credentials);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load credentials");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (!isDesktop) {
    return (
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>
        Credentials are stored in the OS keychain, which only exists in the desktop app.
        In the browser, Lumina reads provider keys from the backend's environment.
      </div>
    );
  }

  const save = async (name: string) => {
    setBusy(true);
    try {
      const result = await setCredential(name, draft);
      setCredentials(result.credentials);
      setEditing(null);
      setDraft("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const clear = async (name: string) => {
    setBusy(true);
    try {
      const result = await removeCredential(name);
      setCredentials(result.credentials);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setBusy(false);
    }
  };

  const groups: { key: CredentialStatus["category"]; title: string }[] = [
    { key: "provider", title: "MODEL PROVIDERS" },
    { key: "email", title: "EMAIL (SMTP)" },
  ];

  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>

      {error && (
        <div style={{ color: "rgba(255,110,110,0.9)", marginBottom: 12, lineHeight: 1.6 }}>{error}</div>
      )}

      {groups.map(group => (
        <div key={group.key} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
            {group.title}
          </div>

          {credentials.filter(entry => entry.category === group.key).map(entry => (
            <div key={entry.name} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: entry.set ? "rgba(80,220,140,0.9)" : "rgba(255,255,255,0.25)", fontSize: 9 }}>
                  ●
                </span>
                <span style={{ flex: 1, color: "rgba(255,255,255,0.75)" }}>{entry.label}</span>
                <button
                  onClick={() => { setEditing(editing === entry.name ? null : entry.name); setDraft(""); }}
                  style={linkButton}
                >
                  {entry.set ? "replace" : "add"}
                </button>
                {entry.set && (
                  <button onClick={() => void clear(entry.name)} style={linkButton} disabled={busy}>
                    remove
                  </button>
                )}
              </div>

              {editing === entry.name && (
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input
                    type="password"
                    value={draft}
                    autoFocus
                    placeholder={`Paste ${entry.name}`}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={event => { if (event.key === "Enter") void save(entry.name); }}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      fontSize: 11,
                      fontFamily: "var(--font-mono)",
                      color: "rgba(255,255,255,0.9)",
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 5,
                      outline: "none",
                    }}
                  />
                  <button onClick={() => void save(entry.name)} disabled={busy} style={linkButton}>
                    save
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", lineHeight: 1.7, marginTop: 4 }}>
        Encrypted with the OS keychain and injected into the backend process at launch.
        Saving a key restarts the backend so it takes effect.
      </div>
    </div>
  );
}

const linkButton = {
  background: "none",
  border: "none",
  color: "rgba(255,255,255,0.45)",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
  cursor: "pointer",
  padding: 0,
} as const;
