// Placeholder bubbles shown while a chat's history loads (avoids a blank flash).
export function ChatSkeleton() {
  return (
    <div className="flex-1 overflow-hidden" aria-hidden>
      <div className="mx-auto max-w-chat space-y-8 px-4 py-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <div className="flex justify-end">
              <div className="h-9 w-2/5 animate-pulse rounded-2xl bg-elevated" />
            </div>
            <div className="space-y-2 pt-1">
              <div className="h-3.5 w-11/12 animate-pulse rounded bg-elevated" />
              <div className="h-3.5 w-4/5 animate-pulse rounded bg-elevated" />
              <div className="h-3.5 w-3/5 animate-pulse rounded bg-elevated" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
