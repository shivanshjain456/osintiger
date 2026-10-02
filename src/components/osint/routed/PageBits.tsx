"use client";

// Shared UI primitives for the new routed views. Keeps the cyberpunk/hacker
// aesthetic consistent across every page without duplicating markup.

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { Route } from "@/lib/router/types";
import { useNavigate } from "@/lib/router/useRouter";

// ─── Page header ─────────────────────────────────────────────────────────────
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  accent = "green",
  actions,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  accent?: "green" | "cyan" | "amber" | "red" | "purple";
  actions?: ReactNode;
}) {
  const accentColor = {
    green: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5",
    cyan: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/5",
    amber: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/5",
    red: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5",
    purple: "text-[var(--hack-purple)] border-[var(--hack-purple)]/40 bg-[var(--hack-purple)]/5",
  }[accent];
  const iconColor = {
    green: "text-[var(--hack-green)]",
    cyan: "text-[var(--hack-cyan)]",
    amber: "text-[var(--hack-amber)]",
    red: "text-[var(--hack-red)]",
    purple: "text-[var(--hack-purple)]",
  }[accent];
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`flex h-10 w-10 items-center justify-center border shrink-0 ${accentColor}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold font-mono tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-[var(--hack-gray)] font-mono mt-0.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────
export interface Crumb {
  label: string;
  route?: Route;
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const navigate = useNavigate();
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-[11px] font-mono flex-wrap">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {c.route && !isLast ? (
              <button
                onClick={() => navigate(c.route!)}
                className="text-[var(--hack-gray)] hover:text-[var(--hack-green)] transition"
              >
                {c.label}
              </button>
            ) : (
              <span className={isLast ? "text-[var(--hack-green)]" : "text-[var(--hack-gray)]"}>
                {c.label}
              </span>
            )}
            {!isLast && <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]/40" />}
          </span>
        );
      })}
    </nav>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────
export function SectionHeader({
  title,
  icon: Icon,
  count,
  right,
}: {
  title: string;
  icon?: LucideIcon;
  count?: number;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] section-header flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {title}
        {count != null && (
          <span className="text-[var(--hack-gray)]/60 normal-case tracking-normal">
            ({count})
          </span>
        )}
      </h2>
      {right}
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "green",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  accent?: "green" | "cyan" | "amber" | "red" | "purple";
}) {
  const color = {
    green: "text-[var(--hack-green)] border-[var(--hack-green)]/30",
    cyan: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/30",
    amber: "text-[var(--hack-amber)] border-[var(--hack-amber)]/30",
    red: "text-[var(--hack-red)] border-[var(--hack-red)]/30",
    purple: "text-[var(--hack-purple)] border-[var(--hack-purple)]/30",
  }[accent];
  return (
    <div className={`border ${color} bg-black/20 p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--hack-gray)]">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${color.split(" ")[0]}`} />
      </div>
      <div className={`text-2xl font-bold font-mono ${color.split(" ")[0]}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[10px] text-[var(--hack-gray)]/70 font-mono">{hint}</div>
      )}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-[var(--hack-border)] bg-black/10">
      <Icon className="h-10 w-10 text-[var(--hack-gray)]/40 mb-3" />
      <h3 className="text-sm font-mono font-semibold text-[var(--hack-gray)] mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-[var(--hack-gray)]/60 font-mono max-w-md">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Inline link button (navigates a route) ──────────────────────────────────
export function RouteLink({
  route,
  children,
  className = "",
}: {
  route: Route;
  children: ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(route)}
      className={`font-mono text-xs uppercase tracking-wider transition ${className}`}
    >
      {children}
    </button>
  );
}

// ─── Tag/badge ───────────────────────────────────────────────────────────────
export function Tag({
  children,
  color = "green",
}: {
  children: ReactNode;
  color?: "green" | "cyan" | "amber" | "red" | "purple" | "gray";
}) {
  const c = {
    green: "border-[var(--hack-green)]/30 text-[var(--hack-green)] bg-[var(--hack-green)]/5",
    cyan: "border-[var(--hack-cyan)]/30 text-[var(--hack-cyan)] bg-[var(--hack-cyan)]/5",
    amber: "border-[var(--hack-amber)]/30 text-[var(--hack-amber)] bg-[var(--hack-amber)]/5",
    red: "border-[var(--hack-red)]/30 text-[var(--hack-red)] bg-[var(--hack-red)]/5",
    purple: "border-[var(--hack-purple)]/30 text-[var(--hack-purple)] bg-[var(--hack-purple)]/5",
    gray: "border-[var(--hack-border)] text-[var(--hack-gray)] bg-black/20",
  }[color];
  return (
    <span className={`inline-flex items-center border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${c}`}>
      {children}
    </span>
  );
}
