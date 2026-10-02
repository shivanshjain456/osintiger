"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Library } from "lucide-react";
import { KnowledgeBasePanel } from "./KnowledgeBasePanel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KnowledgeBaseDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-[var(--hack-bg)] border-[var(--hack-cyan)]/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-[var(--hack-cyan)]">
            <Library className="h-5 w-5" />
            Knowledge Base — Global Intelligence Repository
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] text-[var(--hack-gray)]">
            {"// Persistent memory layer — every investigation enriches the KB for future reuse."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          <KnowledgeBasePanel showIngestBanner={false} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
