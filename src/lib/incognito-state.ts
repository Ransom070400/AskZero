"use client";

import { useSyncExternalStore } from "react";

// Whether the open incognito chat has messages that exiting would discard.
// Set by the chat page, read by anything offering an "exit incognito" action
// (the page banner and the top-nav toggle) so both can confirm first.
let hasMessages = false;
const listeners = new Set<() => void>();

export function setIncognitoHasMessages(next: boolean) {
  if (next === hasMessages) return;
  hasMessages = next;
  listeners.forEach((l) => l());
}

export function useIncognitoHasMessages(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => hasMessages,
    () => false
  );
}
