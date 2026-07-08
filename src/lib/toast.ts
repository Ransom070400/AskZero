// Tiny event-based toast API — call toast.success("…") from anywhere; a single
// <Toaster/> mounted in the root layout renders the stack. No provider needed.
export type ToastVariant = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

type Listener = (t: ToastItem) => void;

const listeners = new Set<Listener>();
let counter = 0;

function emit(message: string, variant: ToastVariant) {
  const item: ToastItem = { id: ++counter, message, variant };
  listeners.forEach((l) => l(item));
}

export const toast = {
  success: (message: string) => emit(message, "success"),
  error: (message: string) => emit(message, "error"),
  info: (message: string) => emit(message, "info"),
};

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
