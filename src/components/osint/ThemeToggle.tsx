"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  // Always initialize with "dark" so the server and client render the same
  // icon. The real theme (from the inline script / localStorage) is read
  // in a useEffect after hydration, preventing hydration mismatches.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Read the theme applied by the inline script in layout.tsx.
    if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) {
      queueMicrotask(() => setTheme("light"));
    }
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
    try {
      localStorage.setItem("osintiger-theme", next);
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center h-8 w-8  border border-white/10 bg-black/30 text-muted-foreground transition hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)]"
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle theme"
      suppressHydrationWarning
    >
      {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}
