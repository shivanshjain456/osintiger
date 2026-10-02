"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tag,
  StickyNote,
  Star,
  X,
  Plus,
  Loader2,
  Check,
} from "lucide-react";
import { patchInvestigationMetadata } from "@/lib/osint/client";

export function NotesEditorDialog({
  open,
  onOpenChange,
  investigationId,
  initialStarred,
  initialTags,
  initialNotes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  investigationId: string;
  initialStarred: boolean;
  initialTags: string[];
  initialNotes: string;
  onSaved?: (data: { starred: boolean; tags: string[]; notes: string }) => void;
}) {
  const [starred, setStarred] = useState(initialStarred);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [notes, setNotes] = useState(initialNotes);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset state when dialog opens with fresh data
  useEffect(() => {
    if (open) {
      setStarred(initialStarred);
      setTags(initialTags);
      setNotes(initialNotes);
      setNewTag("");
      setSaved(false);
    }
  }, [open, initialStarred, initialTags, initialNotes]);

  function addTag() {
    const t = newTag.trim().slice(0, 20);
    if (t && !tags.includes(t) && tags.length < 8) {
      setTags([...tags, t]);
      setNewTag("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await patchInvestigationMetadata(investigationId, {
        starred,
        tags,
        notes,
      });
      setSaved(true);
      onSaved?.({ starred: result.starred, tags: result.tags, notes: result.notes });
      setTimeout(() => onOpenChange(false), 800);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card/95 backdrop-blur-xl border-[var(--hack-green)]/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <StickyNote className="h-5 w-5 text-[var(--hack-green)]" />
            Edit Investigation
          </DialogTitle>
          <DialogDescription className="sr-only">
            Star, tag, and add notes to this investigation. Changes persist to the database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Star toggle */}
          <div className="flex items-center justify-between  border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2">
              <Star className={`h-4 w-4 ${starred ? "fill-var(--hack-green) text-[var(--hack-green)]" : "text-muted-foreground"}`} />
              <span className="text-sm font-medium">Starred</span>
            </div>
            <button
              onClick={() => setStarred(!starred)}
              className={`relative h-6 w-11  transition-colors ${
                starred ? "bg-[var(--hack-green)]" : "bg-zinc-700"
              }`}
              role="switch"
              aria-checked={starred}
            >
              <span
                className={`absolute top-0.5 h-5 w-5  bg-white transition-transform ${
                  starred ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Tag className="h-3 w-3" />
              Tags ({tags.length}/8)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="gap-1 border-[var(--hack-green)]/30 bg-[var(--hack-green)]/10 text-[var(--hack-cyan)] pr-1"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className=" hover:bg-[var(--hack-green)]/20 p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {tags.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No tags yet</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add a tag…"
                maxLength={20}
                className="bg-black/40 h-8 text-sm"
                disabled={tags.length >= 8}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={addTag}
                disabled={!newTag.trim() || tags.length >= 8}
                className="h-8 px-2"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Analyst Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              placeholder="Add private analyst notes, observations, follow-up actions…"
              className="w-full min-h-[100px]  border border-white/10 bg-black/40 p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-var(--hack-green)/40"
            />
            <div className="mt-1 text-right text-[10px] text-muted-foreground font-mono">
              {notes.length}/2000
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={saving}
              className="bg-[var(--hack-green)] text-black hover:bg-[var(--hack-green)]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
              {saved ? "Saved" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
