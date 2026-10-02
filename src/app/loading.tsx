export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--hack-bg)]">
      <div className="text-center">
        <div className="inline-block animate-spin h-8 w-8 border-2 border-[var(--hack-green)] border-t-transparent mb-4" />
        <p className="text-sm text-[var(--hack-green)] font-mono">
          {"// initializing OSINTiger..."}
        </p>
      </div>
    </div>
  );
}
