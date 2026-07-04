import { Linking, Platform, type TextStyle, type ViewStyle } from "react-native";
import Markdown from "react-native-markdown-display";
import { colors } from "@/lib/theme";

const mono = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

// Dark-theme markdown styles matching the app. Keyed by the renderer's rule names.
const styles: Record<string, TextStyle | ViewStyle> = {
  body: { color: "#ededed", fontSize: 15.5, lineHeight: 22 },
  paragraph: { marginTop: 0, marginBottom: 10 },
  heading1: { color: "#fff", fontSize: 21, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  heading2: { color: "#fff", fontSize: 18.5, fontWeight: "700", marginTop: 10, marginBottom: 6 },
  heading3: { color: "#fff", fontSize: 16.5, fontWeight: "700", marginTop: 8, marginBottom: 4 },
  heading4: { color: "#fff", fontSize: 15.5, fontWeight: "700", marginTop: 6, marginBottom: 4 },
  strong: { fontWeight: "700", color: "#fff" },
  em: { fontStyle: "italic" },
  link: { color: colors.accentBright, textDecorationLine: "underline" },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  code_inline: {
    backgroundColor: "#242424",
    color: "#e6d8ff",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontFamily: mono,
    fontSize: 13.5,
  },
  code_block: {
    backgroundColor: "#0c0c0c",
    borderColor: "#262626",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: "#e6e6e6",
    fontFamily: mono,
    fontSize: 13,
  },
  fence: {
    backgroundColor: "#0c0c0c",
    borderColor: "#262626",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: "#e6e6e6",
    fontFamily: mono,
    fontSize: 13,
  },
  blockquote: {
    backgroundColor: "#161616",
    borderLeftColor: colors.accent,
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 6,
  },
  hr: { backgroundColor: "#262626", height: 1, marginVertical: 10 },
  table: { borderColor: "#262626", borderWidth: 1, borderRadius: 8, marginVertical: 6 },
  thead: { backgroundColor: "#161616" },
  th: { padding: 7, color: "#fff", fontWeight: "700" },
  td: { padding: 7, borderColor: "#262626" },
  tr: { borderColor: "#262626" },
};

export function AppMarkdown({ children }: { children: string }) {
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
