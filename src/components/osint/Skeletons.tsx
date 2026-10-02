"use client";

// Skeleton loaders for OSINTiger — tiger-striped shimmer placeholders.

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded bg-white/5 ${className}`}
    >
      <div className="absolute inset-0 scanbeam" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className=" border border-white/10 bg-black/20 p-5">
      <SkeletonLine className="h-5 w-40 mb-3" />
      <SkeletonLine className="h-3 w-full mb-2" />
      <SkeletonLine className="h-3 w-4/5 mb-2" />
      <SkeletonLine className="h-3 w-3/5" />
      <div className="mt-4 flex gap-2">
        <SkeletonLine className="h-8 w-24 " />
        <SkeletonLine className="h-8 w-24 " />
      </div>
    </div>
  );
}

export function SkeletonReport() {
  return (
    <div className="space-y-4">
      <div className=" border border-white/10 bg-black/20 p-6 osint-grid">
        <SkeletonLine className="h-3 w-32 mb-2" />
        <SkeletonLine className="h-8 w-64 mb-3" />
        <div className="flex gap-2 mb-4">
          <SkeletonLine className="h-6 w-32 " />
          <SkeletonLine className="h-6 w-24 " />
          <SkeletonLine className="h-6 w-28 " />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLine key={i} className="h-16 " />
          ))}
        </div>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonLine key={i} className="h-9 w-24 " />
        ))}
      </div>
      <div className=" border border-white/10 bg-black/20 p-5 space-y-3">
        <SkeletonLine className="h-4 w-48" />
        <SkeletonLine className="h-3 w-full" />
        <SkeletonLine className="h-3 w-5/6" />
        <SkeletonLine className="h-3 w-4/5" />
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center  border border-dashed border-white/10 bg-black/10 p-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center  bg-[var(--hack-green)]/10 ring-1 ring-var(--hack-green)/20 mb-4">
        <Icon className="h-7 w-7 text-[var(--hack-green)]/70" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
