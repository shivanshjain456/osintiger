"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Key, CheckCircle2, XCircle, Loader2, Trash2, Zap, Shield, Eye, EyeOff,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ConfigStatus {
  hasConfig: boolean;
  provider: string | null;
  model: string;
  isActive: boolean;
  isValidated: boolean;
  lastValidatedAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  lastError: string;
  maskedKey: string;
}

export function LLMConfigDialog({ open, onOpenChange }: Props) {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; provider?: string; model?: string; error?: string; detail?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    fetch("/api/llm-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setStatus(data);
        if (data.hasConfig && data.provider) {
          setProvider(data.provider as "openai" | "anthropic");
          setModel(data.model || "");
        }
        setLoading(false);
      })
      .catch(() => { if (active) { setLoading(false); } });
    return () => { active = false; };
  }, [open]);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch("/api/llm-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model, baseUrl: baseUrl || undefined }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `Save failed (${r.status})`);
      }
      const data = await r.json();
      setSuccess(data.message || "Credentials saved.");
      setApiKey("");
      // Refresh status
      const statusRes = await fetch("/api/llm-config", { cache: "no-store" });
      const statusData = await statusRes.json();
      setStatus(statusData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function validate() {
    setValidating(true);
    setError(null);
    setValidationResult(null);
    try {
      const body: Record<string, string> = { provider, model };
      if (apiKey) body.apiKey = apiKey;
      if (baseUrl) body.baseUrl = baseUrl;

      const r = await fetch("/api/llm-config/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `Validation failed (${r.status})`);
      }
      const data = await r.json();
      setValidationResult(data);
      // Refresh status
      const statusRes = await fetch("/api/llm-config", { cache: "no-store" });
      const statusData = await statusRes.json();
      setStatus(statusData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      const r = await fetch("/api/llm-config", { method: "DELETE" });
      if (!r.ok) throw new Error(`Delete failed (${r.status})`);
      setSuccess("LLM config removed. Platform will use the default AI provider.");
      setApiKey("");
      setModel("");
      setValidationResult(null);
      const statusRes = await fetch("/api/llm-config", { cache: "no-store" });
      const statusData = await statusRes.json();
      setStatus(statusData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const defaultModels: Record<string, string> = {
    openai: "gpt-4o",
    anthropic: "claude-3-5-sonnet-20241022",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[var(--hack-bg)] border-[var(--hack-cyan)]/40 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-[var(--hack-cyan)]">
            <Key className="h-5 w-5" />
            Bring Your Own AI Agent (BYO-LLM)
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] text-[var(--hack-gray)]">
            {"// Configure your own LLM provider credentials. All AI analysis will use your account and quota."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
            <p className="font-mono text-xs text-[var(--hack-gray)]">Loading configuration...</p>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {/* Current status */}
            {status?.hasConfig && (
              <div className={`border p-3 ${status.isValidated ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5" : "border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/5"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {status.isValidated ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--hack-green)]" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-[var(--hack-amber)]" />
                  )}
                  <span className="font-mono text-xs text-[var(--hack-gray)]">
                    Active: <span className="text-[var(--hack-cyan)] capitalize">{status.provider}</span> · {status.model}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--hack-gray)]/50 ml-auto">
                    {status.isValidated ? "Validated" : "Not validated"} · Used {status.usageCount}x
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--hack-gray)]/60">
                  <span>Key: {status.maskedKey}</span>
                  {status.lastError && <span className="text-[var(--hack-red)]">· Last error: {status.lastError.slice(0, 80)}</span>}
                </div>
              </div>
            )}

            {/* Default provider info */}
            {!status?.hasConfig && (
              <div className="border border-[var(--hack-border)] bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[var(--hack-green)]" />
                  <span className="font-mono text-xs text-[var(--hack-gray)]">
                    Using platform default AI provider (ZAI SDK)
                  </span>
                </div>
                <p className="font-mono text-[10px] text-[var(--hack-gray)]/50 mt-1">
                  No custom LLM credentials configured. Configure below to use your own provider.
                </p>
              </div>
            )}

            {/* Provider selector */}
            <div>
              <label className="font-mono text-[10px] uppercase text-[var(--hack-gray)]/60 mb-1.5 block">Provider</label>
              <div className="flex gap-2">
                <button
                  onClick={() => { setProvider("openai"); setModel(defaultModels.openai); }}
                  className={`flex items-center gap-2 border px-3 py-2 font-mono text-xs transition ${
                    provider === "openai" ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)]" : "border-[var(--hack-border)] text-[var(--hack-gray)]"
                  }`}
                >
                  OpenAI
                </button>
                <button
                  onClick={() => { setProvider("anthropic"); setModel(defaultModels.anthropic); }}
                  className={`flex items-center gap-2 border px-3 py-2 font-mono text-xs transition ${
                    provider === "anthropic" ? "border-[var(--hack-purple)]/40 bg-[var(--hack-purple)]/10 text-[var(--hack-purple)]" : "border-[var(--hack-border)] text-[var(--hack-gray)]"
                  }`}
                >
                  Anthropic
                </button>
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="font-mono text-[10px] uppercase text-[var(--hack-gray)]/60 mb-1.5 block">
                API Key {status?.hasConfig && <span className="text-[var(--hack-gray)]/40">(leave empty to use saved key)</span>}
              </label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={status?.hasConfig ? `Saved: ${status.maskedKey}` : "Enter your API key..."}
                  className="bg-black/40 border-[var(--hack-border)] font-mono text-xs text-[var(--hack-green)] pr-10"
                  maxLength={500}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--hack-gray)] hover:text-[var(--hack-cyan)]"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="font-mono text-[10px] uppercase text-[var(--hack-gray)]/60 mb-1.5 block">Model</label>
              <Input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={defaultModels[provider]}
                className="bg-black/40 border-[var(--hack-border)] font-mono text-xs text-[var(--hack-green)]"
                maxLength={100}
              />
              <p className="font-mono text-[9px] text-[var(--hack-gray)]/40 mt-1">
                {provider === "openai" ? "e.g., gpt-4o, gpt-4o-mini, gpt-4-turbo" : "e.g., claude-3-5-sonnet-20241022, claude-3-opus-20240229"}
              </p>
            </div>

            {/* Base URL (optional) */}
            <div>
              <label className="font-mono text-[10px] uppercase text-[var(--hack-gray)]/60 mb-1.5 block">Custom Base URL <span className="text-[var(--hack-gray)]/40">(optional)</span></label>
              <Input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={provider === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com"}
                className="bg-black/40 border-[var(--hack-border)] font-mono text-xs text-[var(--hack-green)]"
                maxLength={200}
              />
              <p className="font-mono text-[9px] text-[var(--hack-gray)]/40 mt-1">
                For proxy, self-hosted, or Azure OpenAI deployments
              </p>
            </div>

            {/* Validation result */}
            {validationResult && (
              <div className={`border p-3 ${validationResult.valid ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5" : "border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5"}`}>
                <div className="flex items-center gap-2">
                  {validationResult.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--hack-green)]" />
                  ) : (
                    <XCircle className="h-4 w-4 text-[var(--hack-red)]" />
                  )}
                  <span className="font-mono text-xs">
                    {validationResult.valid
                      ? `Validated successfully with ${validationResult.provider} / ${validationResult.model}`
                      : `Validation failed: ${validationResult.error || "unknown error"}`}
                  </span>
                </div>
                {validationResult.detail && !validationResult.valid && (
                  <p className="font-mono text-[10px] text-[var(--hack-red)]/70 mt-1">{validationResult.detail}</p>
                )}
              </div>
            )}

            {/* Error/Success messages */}
            {error && (
              <div className="border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5 p-2">
                <p className="font-mono text-xs text-[var(--hack-red)]">{error}</p>
              </div>
            )}
            {success && (
              <div className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 p-2">
                <p className="font-mono text-xs text-[var(--hack-green)]">{success}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <Button
                onClick={save}
                disabled={saving || (!apiKey && !status?.hasConfig) || !model}
                size="sm"
                className="bg-[var(--hack-green)]/10 border border-[var(--hack-green)]/40 text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 font-mono text-xs"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />}
                Save
              </Button>
              <Button
                onClick={validate}
                disabled={validating || !model}
                size="sm"
                className="bg-[var(--hack-cyan)]/10 border border-[var(--hack-cyan)]/40 text-[var(--hack-cyan)] hover:bg-[var(--hack-cyan)]/20 font-mono text-xs"
              >
                {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                Validate
              </Button>
              {status?.hasConfig && (
                <Button
                  onClick={remove}
                  disabled={deleting}
                  size="sm"
                  className="bg-[var(--hack-red)]/10 border border-[var(--hack-red)]/40 text-[var(--hack-red)] hover:bg-[var(--hack-red)]/20 font-mono text-xs ml-auto"
                >
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Remove & Use Default
                </Button>
              )}
            </div>

            {/* Security note */}
            <div className="border-t border-[var(--hack-border)] pt-2">
              <div className="flex items-start gap-2">
                <Shield className="h-3 w-3 text-[var(--hack-green)] shrink-0 mt-0.5" />
                <p className="font-mono text-[9px] text-[var(--hack-gray)]/50 leading-relaxed">
                  API keys are encrypted at rest using AES-256-GCM. Keys are never logged in plaintext,
                  never exposed in API responses after submission, and only decrypted in-memory at call time.
                  Removing your config reverts to the platform default AI provider.
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AlertCircle(props: React.ComponentProps<"svg">) {
  return <XCircle {...props} />;
}
