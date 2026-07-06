"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff } from "lucide-react";
import { EmptyState } from "@/components/chat/empty-state";
import { ChatInput } from "@/components/chat/chat-input";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [incognito, setIncognito] = useState(false);
  const router = useRouter();

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);

    const text = message.trim();
    setMessage("");

    // Incognito → ephemeral session, no chat row created.
    if (incognito) {
      router.push(`/chat/incognito?q=${encodeURIComponent(text)}`);
      return;
    }

    // Create a new chat
    const res = await fetch("/api/chats", { method: "POST" });
    if (!res.ok) {
      setSending(false);
      return;
    }

    const { id } = await res.json();

    // Navigate to chat with the initial message as a search param
    router.push(`/chat/${id}?q=${encodeURIComponent(text)}`);
  };

  return (
    <div className="flex h-full flex-col items-center justify-between px-3 md:px-4 py-4">
      <EmptyState
        onSuggestionClick={(text) => {
          setMessage(text);
        }}
      />
      <div className="w-full max-w-chat pb-2 md:pb-4">
        <div className="mb-2 flex justify-center">
          <button
            type="button"
            onClick={() => setIncognito((v) => !v)}
            aria-pressed={incognito}
            className={cn(
              "press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              incognito
                ? "border-accent/50 bg-accent-muted text-accent"
                : "border-border/70 bg-elevated/60 text-text-tertiary hover:text-foreground"
            )}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Incognito {incognito ? "on" : "off"}
          </button>
        </div>
        <ChatInput
          value={message}
          onChange={setMessage}
          onSend={handleSend}
          disabled={sending}
        />
        <p className="mt-2 text-center text-[11px] text-text-tertiary hidden md:block">
          {incognito
            ? "Incognito — not saved, not remembered. You're still charged per message."
            : "AskZero uses 0G Compute for decentralized AI inference"}
        </p>
      </div>
    </div>
  );
}
