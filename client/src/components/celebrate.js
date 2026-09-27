"use client";

/** A small confetti burst from an element (e.g. the download button). Skipped for reduced motion. */
export async function celebrate(element) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { default: confetti } = await import("canvas-confetti");
  const rect = element?.getBoundingClientRect?.();
  const origin = rect
    ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }
    : { x: 0.5, y: 0.6 };
  confetti({
    particleCount: 70,
    spread: 70,
    startVelocity: 32,
    scalar: 0.9,
    ticks: 160,
    origin,
    colors: ["#007B7B", "#5eead4", "#002A3A", "#fbbf24", "#f472b6"],
    disableForReducedMotion: true,
  });
}
