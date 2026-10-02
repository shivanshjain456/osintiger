"use client";

import { useEffect, useRef, useState } from "react";

// Animated count-up hook — eases a number from 0 to target over `duration` ms.
// Starts when the element enters the viewport (IntersectionObserver).
export function useCountUp(target: number, duration = 1200, startThreshold = 0.3) {
  const [value, setValue] = useState(0);
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLElement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            setActive(true);
          }
        }
      },
      { threshold: startThreshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [startThreshold]);

  useEffect(() => {
    if (!active) return;
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return { value, ref };
}
