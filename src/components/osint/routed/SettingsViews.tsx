"use client";

// Settings views. The index is a hub linking to each settings subpage.
// Subpages wrap existing dialogs (LLM config) or implement real preference
// management against the UserPreference model.

import { useState, useEffect } from "react";
import {
  Settings,
  Key,
  SlidersHorizontal,
  KeyRound,
  BellRing,
  Download,
  Upload,
  ChevronRight,
  Check,
  Loader2,
} from "lucide-react";
import { PageHeader, SectionHeader } from "./PageBits";
import { RouteBreadcrumbs } from "./RouteBreadcrumbs";
import { useNavigate } from "@/lib/router/useRouter";
import { LLMConfigDialog } from "../LLMConfigDialog";
import { ThemeToggle } from "../ThemeToggle";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <RouteBreadcrumbs />
      {children}
    </div>
  );
}

export function SettingsView() {
  const navigate = useNavigate();
  const cards = [
    { route: "settings-llm" as const, icon: Key, title: "AI Provider", desc: "Configure OpenAI / Anthropic credentials for AI synthesis.", accent: "green" as const },
    { route: "settings-preferences" as const, icon: SlidersHorizontal, title: "Preferences", desc: "Theme, density, default investigation mode, and UX defaults.", accent: "cyan" as const },
    { route: "settings-api-keys" as const, icon: KeyRound, title: "Source API Keys", desc: "Bring your own keys for Shodan, VirusTotal, Etherscan, etc.", accent: "amber" as const },
    { route: "settings-notifications" as const, icon: BellRing, title: "Notifications", desc: "Control which events generate notifications.", accent: "purple" as const },
    { route: "settings-export" as const, icon: Download, title: "Data Export", desc: "Export all investigations, KB entities, and audit logs.", accent: "green" as const },
    { route: "settings-import" as const, icon: Upload, title: "Data Import", desc: "Import investigations or entities from JSON.", accent: "cyan" as const },
  ];
  return (
    <Shell>
      <PageHeader icon={Settings} title="Settings" subtitle="// configuration & preferences" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const accent = {
            green: "hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5",
            cyan: "hover:border-[var(--hack-cyan)]/40 hover:bg-[var(--hack-cyan)]/5",
            amber: "hover:border-[var(--hack-amber)]/40 hover:bg-[var(--hack-amber)]/5",
            purple: "hover:border-[var(--hack-purple)]/40 hover:bg-[var(--hack-purple)]/5",
          }[c.accent];
          return (
            <button key={c.route} onClick={() => navigate({ name: c.route })} className={`group text-left border border-[var(--hack-border)] bg-[var(--hack-surface)] p-4 transition ${accent}`}>
              <div className="flex items-center justify-between mb-2">
                <c.icon className="h-5 w-5 text-[var(--hack-green)]" />
                <ChevronRight className="h-4 w-4 text-[var(--hack-gray)] group-hover:translate-x-0.5 transition" />
              </div>
              <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-[var(--hack-green)]">{c.title}</h3>
              <p className="mt-1 text-xs text-[var(--hack-gray)] leading-relaxed">{c.desc}</p>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

// ─── LLM Provider (embeds the existing dialog as an inline panel) ────────────
export function SettingsLlmView() {
  const [open, setOpen] = useState(true);
  return (
    <Shell>
      <PageHeader icon={Key} title="AI Provider" subtitle="// bring your own LLM credentials" accent="green" />
      <div className="max-w-2xl space-y-4">
        <div className="border border-[var(--hack-border)] bg-black/20 p-4">
          <h3 className="font-mono text-xs uppercase tracking-wider text-[var(--hack-green)] mb-2">{"// Active Configuration"}</h3>
          <p className="text-xs text-[var(--hack-gray)] font-mono mb-3">
            Configure your own OpenAI or Anthropic API key. When active, all AI synthesis calls route through your provider with automatic fallback to the default ZAI SDK on error.
          </p>
          <button onClick={() => setOpen(true)} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 transition">
            Open Configuration
          </button>
        </div>
        <div className="border border-[var(--hack-cyan)]/30 bg-[var(--hack-cyan)]/5 p-3">
          <p className="text-[10px] font-mono text-[var(--hack-cyan)]">
            {"// SECURITY: API keys are encrypted at rest with AES-256-GCM. Keys are never returned in full via any API endpoint."}
          </p>
        </div>
      </div>
      <LLMConfigDialog open={open} onOpenChange={setOpen} />
    </Shell>
  );
}

// ─── Preferences ─────────────────────────────────────────────────────────────
export function SettingsPreferencesView() {
  const [clientId] = useState(() => {
    if (typeof window === "undefined") return "anon";
    let id = localStorage.getItem("osintiger.clientId");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("osintiger.clientId", id);
    }
    return id;
  });
  const [prefs, setPrefs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/preferences?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => setPrefs(d.prefs || {}))
      .catch(() => {});
  }, [clientId]);

  async function setPref(key: string, value: string) {
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaving(key);
    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, key, value }),
      });
    } finally {
      setTimeout(() => setSaving(null), 800);
    }
  }

  const prefRows: { key: string; label: string; type: "select" | "text"; options?: string[]; desc: string }[] = [
    { key: "theme", label: "Theme", type: "select", options: ["dark", "light", "system"], desc: "Color scheme. 'system' follows OS preference." },
    { key: "density", label: "Layout Density", type: "select", options: ["comfortable", "compact"], desc: "Spacing between elements." },
    { key: "defaultMode", label: "Default Investigation Mode", type: "select", options: ["standard", "agent", "discovery", "plan", "monitor"], desc: "Pre-selected mode on the new-investigation page." },
    { key: "autoStart", label: "Auto-start polling", type: "select", options: ["true", "false"], desc: "Immediately poll after starting an investigation." },
  ];

  return (
    <Shell>
      <PageHeader icon={SlidersHorizontal} title="Preferences" subtitle="// per-browser UX defaults" accent="cyan" />
      <div className="max-w-2xl space-y-3">
        {prefRows.map((row) => (
          <div key={row.key} className="border border-[var(--hack-border)] bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <label className="font-mono text-xs font-semibold text-[var(--hack-green)] uppercase tracking-wider">{row.label}</label>
                <p className="text-[10px] text-[var(--hack-gray)] font-mono mt-0.5">{row.desc}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {saving === row.key && <Loader2 className="h-3 w-3 animate-spin text-[var(--hack-green)]" />}
                <select
                  value={prefs[row.key] || ""}
                  onChange={(e) => setPref(row.key, e.target.value)}
                  className="bg-[var(--hack-surface)] border border-[var(--hack-border)] px-2 py-1 text-xs font-mono text-[var(--hack-green)] focus:outline-none focus:border-[var(--hack-green)]/40"
                >
                  <option value="">default</option>
                  {row.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between border border-[var(--hack-border)] bg-black/20 p-3">
          <div>
            <label className="font-mono text-xs font-semibold text-[var(--hack-green)] uppercase tracking-wider">Theme Toggle (quick)</label>
            <p className="text-[10px] text-[var(--hack-gray)] font-mono mt-0.5">Cycle theme immediately.</p>
          </div>
          <ThemeToggle />
        </div>
        <div className="border border-[var(--hack-cyan)]/30 bg-[var(--hack-cyan)]/5 p-3">
          <p className="text-[10px] font-mono text-[var(--hack-cyan)]">
            {"// Preferences are stored per-browser (client id: "}<code className="text-[var(--hack-green)]">{clientId.slice(0, 8)}</code>{"). They persist across sessions on this device."}
          </p>
        </div>
      </div>
    </Shell>
  );
}

// ─── Source API Keys ─────────────────────────────────────────────────────────
export function SettingsApiKeysView() {
  const [keys, setKeys] = useState<Array<{ sourceKey: string; sourceLabel: string; isActive: boolean; isValidated: boolean; lastError: string; docsUrl: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/source-keys");
      const d = await r.json();
      setKeys(d.sources || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function saveKey(sourceKey: string) {
    if (!keyValue.trim()) return;
    setSaveStatus("saving");
    try {
      const r = await fetch("/api/source-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey, apiKey: keyValue }),
      });
      if (!r.ok) throw new Error("Save failed");
      setSaveStatus("saved");
      setKeyValue("");
      setEditing(null);
      load();
    } catch {
      setSaveStatus("error");
    } finally {
      setTimeout(() => setSaveStatus(null), 1500);
    }
  }

  async function deleteKey(sourceKey: string) {
    if (!confirm(`Remove API key for ${sourceKey}?`)) return;
    await fetch(`/api/source-keys?sourceKey=${encodeURIComponent(sourceKey)}`, { method: "DELETE" });
    load();
  }

  const knownSources = [
    { key: "shodan", label: "Shodan", docs: "https://www.shodan.io/" },
    { key: "virustotal", label: "VirusTotal", docs: "https://www.virustotal.com/" },
    { key: "etherscan", label: "Etherscan", docs: "https://etherscan.io/" },
    { key: "abuseipdb", label: "AbuseIPDB", docs: "https://www.abuseipdb.com/" },
    { key: "greynoise", label: "GreyNoise", docs: "https://www.greynoise.io/" },
    { key: "urlscan", label: "URLScan.io", docs: "https://urlscan.io/" },
  ];

  return (
    <Shell>
      <PageHeader icon={KeyRound} title="Source API Keys" subtitle="// optional credentials for higher rate limits" accent="amber" />
      <div className="max-w-3xl">
        <div className="mb-4 border border-[var(--hack-cyan)]/30 bg-[var(--hack-cyan)]/5 p-3">
          <p className="text-[10px] font-mono text-[var(--hack-cyan)]">
            {"// OPTIONAL. OSINTiger works without any keys using free public tiers. Adding your own keys raises rate limits and unlocks additional data for supported sources. Keys are AES-256-GCM encrypted at rest."}
          </p>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
        ) : (
          <div className="space-y-2">
            {knownSources.map((src) => {
              const existing = keys.find((k) => k.sourceKey === src.key);
              const isEditing = editing === src.key;
              return (
                <div key={src.key} className="border border-[var(--hack-border)] bg-black/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-[var(--hack-green)]">{src.label}</span>
                      {existing?.isActive && existing?.isValidated && (
                        <span className="flex items-center gap-1 text-[9px] font-mono text-[var(--hack-green)]"><Check className="h-3 w-3" /> VALIDATED</span>
                      )}
                      {existing?.lastError && (
                        <span className="text-[9px] font-mono text-[var(--hack-red)]">⚠ {existing.lastError.slice(0, 40)}</span>
                      )}
                    </div>
                    <a href={src.docs} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-[var(--hack-cyan)] hover:underline">get key →</a>
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={keyValue}
                        onChange={(e) => setKeyValue(e.target.value)}
                        placeholder={`Paste your ${src.label} API key…`}
                        className="flex-1 bg-[var(--hack-surface)] border border-[var(--hack-border)] px-2 py-1.5 text-xs font-mono text-[var(--hack-green)] focus:outline-none focus:border-[var(--hack-green)]/40"
                      />
                      <button onClick={() => saveKey(src.key)} disabled={!keyValue.trim()} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-3 py-1.5 text-[10px] font-mono uppercase text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 disabled:opacity-40">
                        {saveStatus === "saving" ? "…" : "Save"}
                      </button>
                      <button onClick={() => { setEditing(null); setKeyValue(""); }} className="text-[10px] font-mono text-[var(--hack-gray)] hover:text-[var(--hack-red)]">cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {existing ? (
                        <>
                          <code className="text-xs font-mono text-[var(--hack-gray)]">••••••••••••••••</code>
                          <button onClick={() => deleteKey(src.key)} className="ml-auto text-[10px] font-mono text-[var(--hack-red)] hover:underline">remove</button>
                          <button onClick={() => { setEditing(src.key); setKeyValue(""); }} className="text-[10px] font-mono text-[var(--hack-cyan)] hover:underline">replace</button>
                        </>
                      ) : (
                        <button onClick={() => setEditing(src.key)} className="text-[10px] font-mono text-[var(--hack-green)] hover:underline">+ add key</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}

// ─── Notification settings ───────────────────────────────────────────────────
export function SettingsNotificationsView() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    "investigation.complete": true,
    "monitor.alert": true,
    "kb.conflict": true,
    "kb.gap": false,
    "system.maintenance": true,
    "audit.critical": true,
  });

  function toggle(key: string) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  const rows = [
    { key: "investigation.complete", label: "Investigation Complete", desc: "When an investigation finishes synthesizing its report." },
    { key: "monitor.alert", label: "Monitor Alert", desc: "When a live monitor detects a change exceeding threshold." },
    { key: "kb.conflict", label: "KB Conflict Detected", desc: "When sources disagree on a fact about an entity." },
    { key: "kb.gap", label: "Intelligence Gap", desc: "When the gap analyzer identifies a missing dimension." },
    { key: "system.maintenance", label: "System Maintenance", desc: "Scheduled or unscheduled maintenance windows." },
    { key: "audit.critical", label: "Critical Audit Event", desc: "Critical-severity actions (deletions, config changes)." },
  ];

  return (
    <Shell>
      <PageHeader icon={BellRing} title="Notification Settings" subtitle="// control which events notify you" accent="purple" />
      <div className="max-w-2xl space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between border border-[var(--hack-border)] bg-black/20 p-3">
            <div>
              <label className="font-mono text-xs font-semibold text-[var(--hack-green)] uppercase tracking-wider">{r.label}</label>
              <p className="text-[10px] text-[var(--hack-gray)] font-mono mt-0.5">{r.desc}</p>
            </div>
            <button
              onClick={() => toggle(r.key)}
              className={`relative h-5 w-10 rounded-full border transition ${prefs[r.key] ? "bg-[var(--hack-green)]/30 border-[var(--hack-green)]/60" : "bg-black/30 border-[var(--hack-border)]"}`}
              role="switch"
              aria-checked={prefs[r.key]}
            >
              <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition ${prefs[r.key] ? "left-5 bg-[var(--hack-green)]" : "left-0.5 bg-[var(--hack-gray)]"}`} />
            </button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ─── Data Export ─────────────────────────────────────────────────────────────
export function SettingsExportView() {
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function exportAll() {
    setExporting(true);
    setStatus(null);
    try {
      const r = await fetch("/api/export/all");
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `osintiger-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Export complete.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Shell>
      <PageHeader icon={Download} title="Data Export" subtitle="// export all platform data" accent="green" />
      <div className="max-w-2xl space-y-4">
        <div className="border border-[var(--hack-border)] bg-black/20 p-4">
          <h3 className="font-mono text-sm font-semibold text-[var(--hack-green)] uppercase mb-2">Full Export</h3>
          <p className="text-xs text-[var(--hack-gray)] font-mono mb-3">
            Download a JSON archive of all investigations, knowledge-base entities, relationships, evidence, provenance events, and audit logs. Suitable for backup or migration.
          </p>
          <button onClick={exportAll} disabled={exporting} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 disabled:opacity-40 flex items-center gap-2">
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? "Exporting…" : "Export Everything"}
          </button>
          {status && <p className="mt-2 text-xs font-mono text-[var(--hack-cyan)]">{status}</p>}
        </div>
      </div>
    </Shell>
  );
}

// ─── Data Import ─────────────────────────────────────────────────────────────
export function SettingsImportView() {
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFile(file: File) {
    setImporting(true);
    setStatus(null);
    try {
      const text = await file.text();
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Import failed");
      setStatus(`Imported ${d.imported || 0} records.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Shell>
      <PageHeader icon={Upload} title="Data Import" subtitle="// import from JSON archive" accent="cyan" />
      <div className="max-w-2xl space-y-4">
        <div className="border border-[var(--hack-border)] bg-black/20 p-4">
          <h3 className="font-mono text-sm font-semibold text-[var(--hack-green)] uppercase mb-2">Import JSON</h3>
          <p className="text-xs text-[var(--hack-gray)] font-mono mb-3">
            Upload a previously-exported JSON archive. Entities with matching normalized names will be merged; others will be created as new.
          </p>
          <label className="flex items-center justify-center border-2 border-dashed border-[var(--hack-border)] hover:border-[var(--hack-green)]/40 p-8 cursor-pointer transition">
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {importing ? (
              <span className="flex items-center gap-2 text-xs font-mono text-[var(--hack-green)]"><Loader2 className="h-4 w-4 animate-spin" /> Importing…</span>
            ) : (
              <span className="flex items-center gap-2 text-xs font-mono text-[var(--hack-gray)]"><Upload className="h-4 w-4" /> Click to select a JSON file</span>
            )}
          </label>
          {status && <p className="mt-2 text-xs font-mono text-[var(--hack-cyan)]">{status}</p>}
        </div>
      </div>
    </Shell>
  );
}
