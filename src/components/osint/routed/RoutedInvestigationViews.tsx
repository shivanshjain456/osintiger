"use client";

// Routed wrappers for the existing investigation views. These translate a
// hash-route (which only carries an id) into the props the original view
// components expect (which carry the full target/poll object). This keeps the
// original components untouched while making them URL-addressable.

import { useEffect, useState } from "react";
import { ProgressView } from "../ProgressView";
import { ReportView } from "../ReportView";
import { AgentView } from "../AgentView";
import { DiscoveryView } from "../DiscoveryView";
import { PlanView } from "../PlanView";
import { LiveMonitoringView } from "../LiveMonitoringView";
import { useNavigate } from "@/lib/router/useRouter";
import { pollInvestigation, fetchRecent, type PollResponse } from "@/lib/osint/client";
import { Loader2 } from "lucide-react";

function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)] mb-3" />
      <span className="font-mono text-xs text-[var(--hack-gray)]">{label}</span>
    </div>
  );
}

function NotFound({ id, label }: { id: string; label: string }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-xl font-mono font-semibold text-[var(--hack-red)] mb-2">
        {label} not found
      </h1>
      <p className="text-sm text-[var(--hack-gray)] font-mono mb-6">
        No record with id <code className="text-[var(--hack-cyan)]">{id}</code> exists. It may have expired.
      </p>
      <button
        onClick={() => navigate({ name: "investigations" })}
        className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/15"
      >
        Back to Investigations
      </button>
    </div>
  );
}

/** Standard investigation progress view, resolved from a route id. */
export function RoutedProgressView({ id }: { id: string }) {
  const navigate = useNavigate();
  const [target, setTarget] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Try to resolve a friendly target label from recent investigations.
    fetchRecent()
      .then((r) => {
        if (cancelled) return;
        const found = r.investigations.find((i) => i.id === id);
        setTarget(found ? found.target : id);
        if (!found) setMissing(true);
      })
      .catch(() => {
        if (!cancelled) setTarget(id);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing && !target) return <NotFound id={id} label="Investigation" />;
  if (!target) return <FullPageLoader label={`resolving investigation ${id.slice(0, 8)}…`} />;

  return (
    <ProgressView
      id={id}
      target={target}
      onHome={() => navigate({ name: "home" })}
      onComplete={(poll: PollResponse) =>
        navigate({ name: "investigation-report", params: { id: poll.investigation_id } })
      }
    />
  );
}

/** Investigation report view, resolved from a route id (fetches poll). */
export function RoutedReportView({ id }: { id: string }) {
  const navigate = useNavigate();
  const [poll, setPoll] = useState<PollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    pollInvestigation(id)
      .then((p) => {
        if (!cancelled) setPoll(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load report");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <NotFound id={id} label="Report" />;
  if (!poll) return <FullPageLoader label={`loading report ${id.slice(0, 8)}…`} />;

  return (
    <ReportView
      poll={poll}
      onHome={() => navigate({ name: "home" })}
      onNewInvestigation={(newId, newTarget) =>
        navigate({ name: "investigation", params: { id: newId } })
      }
    />
  );
}

/** Autonomous agent view. */
export function RoutedAgentView({ id }: { id: string }) {
  const navigate = useNavigate();
  return <AgentView id={id} target={id.slice(0, 8)} onHome={() => navigate({ name: "home" })} />;
}

/** Discovery session view. */
export function RoutedDiscoveryView({ id }: { id: string }) {
  const navigate = useNavigate();
  return <DiscoveryView id={id} target={id.slice(0, 8)} onHome={() => navigate({ name: "home" })} />;
}

/** AI plan view. */
export function RoutedPlanView({ id }: { id: string }) {
  const navigate = useNavigate();
  return <PlanView id={id} target={id.slice(0, 8)} onHome={() => navigate({ name: "home" })} />;
}

/** Live monitor view. */
export function RoutedMonitorView({ id }: { id: string }) {
  const navigate = useNavigate();
  return <LiveMonitoringView id={id} target={id.slice(0, 8)} onHome={() => navigate({ name: "home" })} />;
}
