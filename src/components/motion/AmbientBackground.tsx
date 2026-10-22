"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Ambient animated background: slow-drifting gradient orbs. Purely decorative,
 * pointer-events-none, and disabled under prefers-reduced-motion.
 */
export function AmbientBackground() {
  const reduce = useReducedMotion();
  const orbs = [
    { className: "left-[8%] top-[6%] h-72 w-72 bg-accent/25", dur: 16, dx: 40, dy: 30 },
    { className: "right-[6%] top-[12%] h-80 w-80 bg-accent-2/20", dur: 20, dx: -50, dy: 40 },
    { className: "left-[40%] bottom-[4%] h-72 w-72 bg-accent-3/15", dur: 18, dx: 30, dy: -40 },
  ];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-[110px] ${o.className}`}
          animate={reduce ? undefined : { x: [0, o.dx, 0], y: [0, o.dy, 0] }}
          transition={{ duration: o.dur, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
