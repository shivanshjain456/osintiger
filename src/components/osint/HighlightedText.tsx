"use client";

// Highlights matching keywords in text with amber background.
export function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query || !query.trim()) return <>{text}</>;

  const q = query.trim();
  // Escape regex special chars
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) => {
        if (part.toLowerCase() === q.toLowerCase()) {
          return (
            <mark
              key={i}
              className="bg-[var(--hack-green)]/30 text-[var(--hack-cyan)] rounded px-0.5"
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
