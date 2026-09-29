"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Code2, EyeOff, ImageIcon, Telescope } from "lucide-react";
import { EmptyState } from "@/components/chat/empty-state";
import { ChatInput } from "@/components/chat/chat-input";
import { ModelPicker } from "@/components/chat/model-picker";
import { useModelSelection } from "@/hooks/use-model-selection";
import { CHAT_STYLES, type ChatStyle } from "@/lib/system-prompt";

const STYLE_KEY = "askzero:chat-style";

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [incognito, setIncognito] = useState(false);
  const [style, setStyle] = useState<ChatStyle>("default");
  const { models, selected, select } = useModelSelection();
  const router = useRouter();

  // Answer style is shared with the chat page through localStorage.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STYLE_KEY);
      if (CHAT_STYLES.some((s) => s.id === saved)) setStyle(saved as ChatStyle);
    } catch {
      // storage blocked — keep the default
    }
  }, []);

  const updateStyle = (next: ChatStyle) => {
    setStyle(next);
    try {
      localStorage.setItem(STYLE_KEY, next);
    } catch {
      // non-fatal
    }
  };

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

    // Navigate to chat with the initial message as a search param. The chosen
    // model travels via useModelSelection's saved selection.
    router.push(`/chat/${id}?q=${encodeURIComponent(text)}`);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 md:px-4">
      <EmptyState
        onSuggestionClick={setMessage}
        composer={
          <ChatInput
            value={message}
            onChange={setMessage}
            onSend={handleSend}
            disabled={sending}
            placeholder={
              incognito
                ? "Ask privately — not saved, not remembered"
                : "Ask anything"
            }
            badge={
              incognito
                ? {
                    label: "Incognito",
                    icon: EyeOff,
                    onClear: () => setIncognito(false),
                  }
                : undefined
            }
            commands={[
              {
                id: "research",
                label: "Research",
                description: "Cited multi-source report",
                icon: Telescope,
                run: () => router.push("/research"),
              },
              {
                id: "code",
                label: "Code",
                description: "Build a working app with preview",
                icon: Code2,
                run: () => router.push("/code"),
              },
              {
                id: "image",
                label: "Image",
                description: "Generate a picture",
                icon: ImageIcon,
                run: () => setMessage("generate an image of "),
              },
              {
                id: "incognito",
                label: incognito ? "Incognito on" : "Incognito",
                description: "Not saved, not remembered",
                icon: EyeOff,
                run: () => setIncognito((v) => !v),
              },
            ]}
            toolbarRight={
              models.length > 0 && selected ? (
                <ModelPicker
                  models={models}
                  selected={selected}
                  disabled={sending}
                  onSelect={select}
                  settings={[
                    {
                      id: "style",
                      label: "Answer style",
                      value: style,
                      options: CHAT_STYLES,
                      onChange: (v) => updateStyle(v as ChatStyle),
                    },
                  ]}
                />
              ) : null
            }
          />
        }
      />
    </div>
  );
}
