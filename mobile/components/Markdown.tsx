import { useMemo } from "react";
import { Linking, Platform, type TextStyle, type ViewStyle } from "react-native";
import Markdown from "react-native-markdown-display";
import { useTheme } from "@/lib/theme-context";
import type { Palette } from "@/lib/theme";

const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

function makeStyles(c: Palette): Record<string, TextStyle | ViewStyle> {
  return {
    body: { color: c.aiText, fontSize: 15.5, lineHeight: 22 },
    paragraph: { marginTop: 0, marginBottom: 10 },
    heading1: { color: c.text, fontSize: 21, fontWeight: "700", marginTop: 10, marginBottom: 6 },
    heading2: { color: c.text, fontSize: 18.5, fontWeight: "700", marginTop: 10, marginBottom: 6 },
    heading3: { color: c.text, fontSize: 16.5, fontWeight: "700", marginTop: 8, marginBottom: 4 },
    heading4: { color: c.text, fontSize: 15.5, fontWeight: "700", marginTop: 6, marginBottom: 4 },
    strong: { fontWeight: "700", color: c.text },
    em: { fontStyle: "italic" },
    link: { color: c.accentBright, textDecorationLine: "underline" },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginVertical: 2 },
    code_inline: {
      backgroundColor: c.card,
      color: c.accent,
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 1,
      fontFamily: mono,
      fontSize: 13.5,
    },
    code_block: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      color: c.text,
      fontFamily: mono,
      fontSize: 13,
    },
    fence: {
      backgroundColor: c.surface,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      color: c.text,
      fontFamily: mono,
      fontSize: 13,
    },
    blockquote: {
      backgroundColor: c.card,
      borderLeftColor: c.accent,
      borderLeftWidth: 3,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginVertical: 6,
    },
    hr: { backgroundColor: c.border, height: 1, marginVertical: 10 },
    table: { borderColor: c.border, borderWidth: 1, borderRadius: 8, marginVertical: 6 },
    thead: { backgroundColor: c.card },
    th: { padding: 7, color: c.text, fontWeight: "700" },
    td: { padding: 7, borderColor: c.border },
    tr: { borderColor: c.border },
  };
}

export function AppMarkdown({ children }: { children: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Markdown
      style={styles}
      onLinkPress={(url) => {
        Linking.openURL(url).catch(() => {});
        return false;
      }}
    >
      {children}
    </Markdown>
  );
}
