import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Redirect } from "expo-router";
import { ChevronLeft, Search, Check, ExternalLink } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { AppMarkdown } from "@/components/Markdown";
import {
  streamResearch,
  RESEARCH_COST,
  type ResearchDepth,
  type ResearchEvent,
  type ResearchSource,
} from "@/lib/api";
import { colors, radius } from "@/lib/theme";

const STEPS = [
  { key: "planning", label: "Planning" },
  { key: "searching", label: "Searching the web" },
  { key: "reading", label: "Reading sources" },
  { key: "synthesizing", label: "Cross-checking & writing" },
] as const;

export default function Research() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState<ResearchDepth>("quick");
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [detail, setDetail] = useState<string>("");
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const q = query.trim();
    if (!q || running) return;
    setRunning(true);
    setPhase("planning");
    setDetail("");
    setReport("");
    setSources([]);
    setError(null);
    try {
      await streamResearch(q, depth, (e: ResearchEvent) => {
        if (e.phase === "error") setError(e.error || "Research failed");
        else if (e.phase === "done") {
          setReport(e.report || "");
          setSources(e.sources || []);
          setPhase("done");
        } else if (e.phase === "settled") {
          /* charged */
        } else {
          setPhase(e.phase);
          if (e.queries) setDetail(e.queries.join(" · "));
          else if (e.sourcesFound != null) setDetail(`${e.sourcesFound} sources`);
          else if (e.phase === "reading" && e.total)
            setDetail(`${e.read}/${e.total} — ${e.sourceTitle ?? ""}`);
          else if (e.message) setDetail(e.message);
        }
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return null;
  if (!session) return <Redirect href="/login" />;

  const stepIndex = STEPS.findIndex((s) => s.key === phase);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 22 }}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Research</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.blurb}>
            AskZero searches the web, reads the sources, cross-checks them, and
            writes a cited report with confidence.
          </Text>

          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="What do you want researched?"
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              multiline
              editable={!running}
            />
            <View style={styles.row}>
              <View style={styles.segmented}>
                {(["quick", "standard"] as ResearchDepth[]).map((d) => {
                  const on = depth === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setDepth(d)}
                      disabled={running}
                      style={[styles.seg, on && styles.segOn]}
                    >
                      <Text style={[styles.segText, on && styles.segTextOn]}>
                        {d} · {RESEARCH_COST[d]}c
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                style={[styles.runBtn, (!query.trim() || running) && styles.disabled]}
                onPress={run}
                disabled={!query.trim() || running}
              >
                {running ? (
                  <ActivityIndicator color={colors.onAccent} size="small" />
                ) : (
                  <Search size={18} color={colors.onAccent} />
                )}
              </Pressable>
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          {running && (
            <View style={styles.card}>
              {STEPS.map((s, i) => {
                const active = i === stepIndex;
                const done = stepIndex > i || phase === "done";
                return (
                  <View key={s.key} style={styles.step}>
                    {done ? (
                      <Check size={15} color={colors.success} />
                    ) : active ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <View style={styles.stepDot} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stepLabel, (active || done) && styles.stepLabelOn]}>
                        {s.label}
                      </Text>
                      {active && detail ? (
                        <Text style={styles.stepDetail} numberOfLines={1}>
                          {detail}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {report ? (
            <View style={styles.reportCard}>
              <AppMarkdown>{report}</AppMarkdown>
            </View>
          ) : null}

          {sources.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sourcesTitle}>Sources</Text>
              {sources.map((s) => (
                <Pressable
                  key={s.n}
                  style={styles.source}
                  onPress={() => Linking.openURL(s.url)}
                >
                  <Text style={styles.sourceN}>[{s.n}]</Text>
                  <Text style={styles.sourceTitle} numberOfLines={1}>
                    {s.title || s.url}
                  </Text>
                  <ExternalLink size={13} color={colors.textTertiary} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  scroll: { padding: 16, gap: 16, paddingBottom: 48 },
  blurb: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 12,
  },
  input: { color: colors.text, fontSize: 16, minHeight: 60, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  segmented: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.sm, padding: 2 },
  seg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  segOn: { backgroundColor: colors.card },
  segText: { color: colors.textTertiary, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  segTextOn: { color: colors.text },
  runBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
  error: { color: colors.error, fontSize: 13 },
  step: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  stepLabel: { color: colors.textTertiary, fontSize: 14, fontWeight: "500" },
  stepLabelOn: { color: colors.text },
  stepDetail: { color: colors.textTertiary, fontSize: 12, marginTop: 1 },
  reportCard: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  report: { color: colors.text, fontSize: 14.5, lineHeight: 22 },
  sourcesTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  source: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  sourceN: { color: colors.textTertiary, fontSize: 12, fontVariant: ["tabular-nums"] },
  sourceTitle: { color: colors.accentBright, fontSize: 13, flex: 1 },
});
