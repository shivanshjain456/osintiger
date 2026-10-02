"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--hack-bg)] px-4">
      <div className="terminal-panel p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="h-12 w-12 text-[var(--hack-red)]" />
        </div>
        <h2 className="text-lg font-bold text-[var(--hack-red)] font-mono mb-2">
          {"// SYSTEM ERROR"}
        </h2>
        <p className="text-sm text-[var(--hack-gray)] font-mono mb-4">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="text-[10px] text-[var(--hack-gray)]/50 font-mono mb-4">
            Error ID: {error.digest}
          </p>
        )}
        <Button
          onClick={reset}
          className="border border-[var(--hack-green)] bg-[var(--hack-green)]/10 text-[var(--hack-green)] hover:bg-[var(--hack-green)] hover:text-[var(--hack-bg)] font-mono text-xs uppercase tracking-wider"
        >
          Retry
        </Button>
      </div>
    </div>
  );
}
