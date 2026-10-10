"use client";

import { useEffect, useRef, useState } from "react";

// Reveals streamed text at an even pace instead of in network-sized bursts.
//
// Text arrives from the stream in uneven chunks (a few words, then a pause,
// then a sentence). This plays it out word by word: the reveal speed tracks
// the backlog — it eases toward the received text over ~350ms — so it never
// falls noticeably behind, but a burst is spread out instead of popping in.
// Once the stream ends the remainder plays out quickly (~150ms).
//
// Text that was never streamed (history) is shown in full immediately, and so
// is everything in a background tab, where requestAnimationFrame doesn't run.
const STREAM_CATCHUP_MS = 350;
const FINISH_CATCHUP_MS = 150;
const MIN_CHARS_PER_MS = 0.04; // ~40 chars/s floor so a trickle keeps moving

export function useSmoothText(target: string, streaming: boolean): string {
  const [shownLength, setShownLength] = useState(() => (streaming ? 0 : target.length));
  const lengthRef = useRef(shownLength);
  const targetRef = useRef(target);
  const streamingRef = useRef(streaming);
  const frameRef = useRef(0);

  targetRef.current = target;
  streamingRef.current = streaming;

  useEffect(() => {
    // Text replaced rather than extended (e.g. reasoning promoted into the
    // answer, or a retry): show it as it is.
    if (lengthRef.current > target.length) {
      lengthRef.current = target.length;
      setShownLength(target.length);
    }
    if (lengthRef.current >= target.length || frameRef.current) return;

    let last = performance.now();
    const tick = (now: number) => {
      const full = targetRef.current;
      const dt = Math.min(now - last, 64);
      last = now;

      let next: number;
      if (typeof document !== "undefined" && document.hidden) {
        next = full.length;
      } else {
        const backlog = full.length - lengthRef.current;
        const window = streamingRef.current ? STREAM_CATCHUP_MS : FINISH_CATCHUP_MS;
        const step = Math.max(MIN_CHARS_PER_MS * dt, (backlog * dt) / window);
        next = Math.min(full.length, lengthRef.current + Math.ceil(step));
        // Finish the word in progress, so text appears word by word rather
        // than letter by letter.
        const space = full.slice(next, next + 16).search(/\s/);
        if (space > 0) next += space;
      }

      lengthRef.current = next;
      setShownLength(next);
      if (next < targetRef.current.length) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = 0;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [target]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  return shownLength >= target.length ? target : target.slice(0, shownLength);
}
