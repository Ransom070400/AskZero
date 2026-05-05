export type ChatStyle = "default" | "concise" | "explanatory" | "code";

export const CHAT_STYLES: { id: ChatStyle; label: string; description: string }[] = [
  { id: "default",     label: "Default",     description: "Balanced and direct" },
  { id: "concise",     label: "Concise",     description: "Short, no preamble" },
  { id: "explanatory", label: "Explanatory", description: "Detailed with examples" },
  { id: "code",        label: "Code",        description: "Code over prose" },
];

const BASE_PROMPT = `You are AskZero, an AI assistant. Prioritize clarity and directness.

Formatting capabilities you can use:
- Fenced code blocks with a language tag: \`\`\`ts, \`\`\`py, \`\`\`sql, \`\`\`bash
- Mermaid diagrams in \`\`\`mermaid blocks (flowchart, sequenceDiagram, erDiagram, etc.)
- LaTeX math: $$display$$ for blocks, $inline$ for inline
- GitHub-flavored markdown tables and task lists

Lead with the answer. Add reasoning only when it helps the reader.`;

const STYLE_OVERLAY: Record<Exclude<ChatStyle, "default">, string> = {
  concise:
    "Style: be terse. 1–3 sentences when possible. No preamble, no restating the question, no closing pleasantries.",
  explanatory:
    "Style: be thorough. Walk through your reasoning step by step. Use concrete examples and analogies. Prefer depth over brevity.",
  code:
    "Style: lead with code. Minimal prose; put explanations in comments inside the code itself. If a question can be answered with code, answer with code.",
};

export function buildSystemPrompt(style: ChatStyle = "default"): string {
  if (style === "default") return BASE_PROMPT;
  return `${BASE_PROMPT}\n\n${STYLE_OVERLAY[style]}`;
}
