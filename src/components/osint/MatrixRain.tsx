"use client";

import { useEffect, useRef, memo } from "react";

// Matrix rain effect — elegant, subtle background.
// Fewer columns, slower speed, gradient opacity (bright at top, fading down),
// and a radial vignette so center content stays readable.
// Memoized so it doesn't re-render when the parent AppShell re-renders on
// navigation — the canvas animation is independent of route state.
export const MatrixRain = memo(function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let columns: number;
    let drops: number[];
    let dropSpeeds: number[];
    let vignetteGradient: CanvasGradient | null = null;
    const fontSize = 16;
    const chars = "01ABCDEF<>{}[]+-=#ﾊﾐﾋｰｳｼﾅﾓﾆ";

    // Respect prefers-reduced-motion — skip the animation entirely.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      ctx.fillStyle = "rgba(10, 10, 10, 1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    function resize() {
      if (!canvas || !ctx) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Fewer columns for a cleaner look — wider spacing
      columns = Math.floor(canvas.width / (fontSize * 2.5));
      drops = new Array(columns).fill(0).map(() => Math.random() * -50);
      dropSpeeds = new Array(columns).fill(0).map(() => 0.3 + Math.random() * 0.4);
      // Cache the radial vignette gradient — only recreate on resize, not every frame.
      vignetteGradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 3, 0,
        canvas.width / 2, canvas.height / 3, canvas.width * 0.6
      );
      vignetteGradient.addColorStop(0, "rgba(10, 10, 10, 0.6)");
      vignetteGradient.addColorStop(0.5, "rgba(10, 10, 10, 0.2)");
      vignetteGradient.addColorStop(1, "rgba(10, 10, 10, 0)");
    }

    // Throttle to ~30fps to halve CPU usage for this background effect.
    let lastDraw = 0;
    const FRAME_INTERVAL = 1000 / 30;

    function draw(timestamp: number) {
      if (!canvas || !ctx) return;
      if (timestamp - lastDraw < FRAME_INTERVAL) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      lastDraw = timestamp;

      // Slightly stronger fade for cleaner trails
      ctx.fillStyle = "rgba(10, 10, 10, 0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";

      const colSpacing = canvas.width / columns;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const y = drops[i] * fontSize;
        const x = i * colSpacing + colSpacing / 2;

        // Distance from center for vignette — center is darker (more readable)
        const distFromCenter = Math.abs(x - canvas.width / 2) / (canvas.width / 2);
        const vignette = 0.4 + distFromCenter * 0.6; // edges brighter, center dimmer

        // Lead character is bright, trailing ones fade
        const isLead = Math.random() > 0.92;
        const opacity = isLead ? 0.12 * vignette : 0.04 * vignette;

        ctx.fillStyle = `rgba(0, 255, 65, ${opacity})`;
        ctx.fillText(char, x, y);

        if (y > canvas.height && Math.random() > 0.98) {
          drops[i] = 0;
        }
        drops[i] += dropSpeeds[i];
      }

      // Use cached vignette gradient (recreated only on resize).
      if (vignetteGradient) {
        ctx.fillStyle = vignetteGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      animationId = requestAnimationFrame(draw);
    }

    resize();
    animationId = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
});
