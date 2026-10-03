// Kept apart from canvas-kit so the page shell can check it without pulling
// three.js into the main bundle.
export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
