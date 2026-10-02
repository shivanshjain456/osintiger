"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { analyzeImageFile, analyzeImageUrl } from "@/lib/osint/client";
import type { VisualIntelResult } from "@/lib/osint/types";
import { ScanEye, Loader2, Upload, Link as LinkIcon, AlertTriangle, ImageIcon } from "lucide-react";
import { ConfidenceMeter } from "./ConfidenceMeter";

export function VisualIntelPanel() {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisualIntelResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image too large (max 8MB).");
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setResult(null);
    try {
      const r = await analyzeImageFile(file);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleUrl() {
    if (!url.trim()) return;
    setError(null);
    setPreview(url.trim());
    setLoading(true);
    setResult(null);
    try {
      const r = await analyzeImageUrl(url.trim());
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanEye className="h-5 w-5 text-[var(--hack-green)]" />
          Visual Intelligence Module
        </CardTitle>
        <CardDescription>
          Upload or link an image for OSINT analysis — geolocation cues, visible text, objects,
          and manipulation signals. Images are analyzed in-memory and not permanently stored.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "upload" ? "default" : "outline"}
            onClick={() => setMode("upload")}
            className={mode === "upload" ? "bg-[var(--hack-green)] text-black hover:bg-[var(--hack-green)]" : ""}
          >
            <Upload className="h-4 w-4" /> Upload
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "url" ? "default" : "outline"}
            onClick={() => setMode("url")}
            className={mode === "url" ? "bg-[var(--hack-green)] text-black hover:bg-[var(--hack-green)]" : ""}
          >
            <LinkIcon className="h-4 w-4" /> Image URL
          </Button>
        </div>

        {mode === "upload" ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2  border-2 border-dashed border-white/15 bg-black/20 p-8 text-center transition hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5"
          >
            <ImageIcon className="h-8 w-8 text-[var(--hack-green)]/70" />
            <p className="text-sm">
              <span className="text-[var(--hack-green)]">Click to upload</span> or drag & drop
            </p>
            <p className="text-[11px] text-muted-foreground">JPG, PNG, WebP — max 8MB</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleUrl();
            }}
          >
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="bg-black/40"
            />
            <Button type="submit" disabled={loading} className="bg-[var(--hack-green)] text-black hover:bg-[var(--hack-green)]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanEye className="h-4 w-4" />}
              Analyze
            </Button>
          </form>
        )}

        {error && <p className="text-sm text-[var(--hack-red)]">{error}</p>}

        {preview && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="relative overflow-hidden  border border-white/10 bg-black/40">
              <img src={preview} alt="Visual intel subject" className="w-full h-auto max-h-80 object-contain" />
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" />
                    <span className="text-xs text-[var(--hack-green)] px-2 py-1 rounded">
                      Scanning image…
                    </span>
                  </div>
                </div>
              )}
            </div>

            {result && (
              <div className="space-y-3">
                <div className=" border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--hack-green)]">Geolocation assessment</span>
                    <Badge variant="outline" className="text-[10px]">{result.sources[0]?.source_label}</Badge>
                  </div>
                  <p className="text-sm font-medium">{result.geolocation}</p>
                  <div className="mt-2">
                    <ConfidenceMeter value={result.confidence} label="confidence" size="sm" />
                  </div>
                </div>

                <div className=" border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Analysis</div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.analysis}</p>
                </div>

                {result.entities.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Identified entities
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.entities.map((e, i) => (
                        <Badge key={i} variant="outline" className="border-[var(--hack-green)]/30 text-[var(--hack-cyan)]">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {result.warnings.length > 0 && (
                  <div className=" border border-[var(--hack-red)]/30 bg-[var(--hack-red)]/5 p-3">
                    <div className="flex items-center gap-1.5 text-[var(--hack-red)] text-xs font-medium mb-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Warnings
                    </div>
                    <ul className="list-disc list-inside text-xs text-[var(--hack-red)]/80 space-y-0.5">
                      {result.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">
                  ⚠ Do not upload sensitive, illegal, or personally-identifying content. Images are processed in-memory only.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
