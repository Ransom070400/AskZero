"use client";

import { useEffect, useState } from "react";

// Number of pixels the on-screen keyboard currently occludes at the bottom of
// the layout viewport.
//
// On iOS Safari the layout viewport (and therefore `100dvh`) does NOT shrink
// when the software keyboard opens — the keyboard simply overlays the bottom
// of the page, hiding any bottom-anchored UI like the chat composer. The
// VisualViewport API does report the shrunken visible area, so we measure the
// gap between the layout viewport and the visual viewport and expose it. The
// composer lifts itself by this amount so it stays above the keyboard.
//
// Returns 0 when there's no keyboard (or no VisualViewport support), so callers
// can apply it unconditionally.
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // Portion of the layout viewport hidden below the visual viewport.
      const occluded = window.innerHeight - vv.height - vv.offsetTop;
      // Ignore small deltas (e.g. the iOS address bar collapsing ~60px) so we
      // only react to an actual keyboard, which is far taller.
      setInset(occluded > 120 ? Math.round(occluded) : 0);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
