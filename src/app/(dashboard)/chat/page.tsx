"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/chat/empty-state";
import { ChatInput } from "@/components/chat/chat-input";

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    setSending(true);

    const text = message.trim();
    setMessage("");

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
        <ChatInput
          value={message}
          onChange={setMessage}
          onSend={handleSend}
          disabled={sending}
        />
        <p className="mt-2 text-center text-[11px] text-text-tertiary hidden md:block">
          AskZero uses 0G Compute for decentralized AI inference
        </p>
      </div>
    </div>
  );
}
