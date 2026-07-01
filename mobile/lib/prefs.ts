import * as SecureStore from "expo-secure-store";

export type ChatStyle = "default" | "concise" | "explanatory" | "code";

export const CHAT_STYLES: { id: ChatStyle; label: string; description: string }[] = [
  { id: "default", label: "Default", description: "Balanced and direct" },
  { id: "concise", label: "Concise", description: "Short, no preamble" },
  { id: "explanatory", label: "Explanatory", description: "Detailed with examples" },
  { id: "code", label: "Code", description: "Code over prose" },
];

const STYLE_KEY = "askzero-chat-style";

export async function getChatStyle(): Promise<ChatStyle> {
  const v = await SecureStore.getItemAsync(STYLE_KEY);
  if (v === "concise" || v === "explanatory" || v === "code") return v;
  return "default";
}

export async function setChatStyle(style: ChatStyle): Promise<void> {
  await SecureStore.setItemAsync(STYLE_KEY, style);
}
