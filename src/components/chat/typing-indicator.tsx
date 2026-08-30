// Shown while an answer is pending — between send and the first token.
//
// Deliberately built to occupy the ANSWER's own slot rather than sit below it
// as a separate row: the label uses the same type metrics as assistant prose
// (15px / 1.7) so when the first token lands, text replaces the label in place
// instead of appearing a `space-y-6` gap above it.
export function TypingIndicator({ model }: { model?: string }) {
  return (
    <div
      className="flex items-baseline gap-2 text-[15px] leading-[1.7]"
      role="status"
      aria-live="polite"
    >
      {/* aria-label carries the state for screen readers; the shimmer is
          decorative and the gradient makes the glyphs themselves transparent,
          so the visible word is hidden from the a11y tree. */}
      <span className="sr-only">Generating a response</span>
      <span aria-hidden="true" className="shimmer-text font-medium">
        Thinking
      </span>
      {model && (
        <span aria-hidden="true" className="text-[12px] text-text-tertiary">
          {model}
        </span>
      )}
    </div>
  );
}
