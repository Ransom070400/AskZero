// Fallback route feedback for the dashboard pages that have no skeleton of
// their own (settings, deposit, code, research, admin). Deliberately plain —
// a neutral shimmer that reads as "working" without pretending to predict a
// layout it doesn't know.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-5 py-8">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-elevated" />
      <div className="h-28 animate-pulse rounded-2xl border border-border/70 bg-elevated/60" />
      <div className="h-28 animate-pulse rounded-2xl border border-border/70 bg-elevated/60" />
    </div>
  );
}
