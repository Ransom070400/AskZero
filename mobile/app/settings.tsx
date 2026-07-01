import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Redirect } from "expo-router";
import { ChevronLeft, ShieldCheck, Trash2 } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { useCurrency, type DisplayCurrency } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import { getBalance, deleteAccount } from "@/lib/api";
import { CHAT_STYLES, getChatStyle, setChatStyle, type ChatStyle } from "@/lib/prefs";
import { colors, radius } from "@/lib/theme";

interface Memory {
  id: string;
  content: string;
  created_at: string;
  og_root_hash: string | null;
}

export default function Settings() {
  const router = useRouter();
  const { session, loading, signOut } = useAuth();
  const { currency, setCurrency, formatBalance } = useCurrency();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [style, setStyle] = useState<ChatStyle>("default");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [deleting, setDeleting] = useState(false);

  const user = session?.user;
  const meta = user?.user_metadata as { avatar_url?: string; picture?: string } | undefined;

  const load = useCallback(async () => {
    if (!user) return;
    getBalance().then(setBalance).catch(() => {});
    getChatStyle().then(setStyle);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single();
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(
        profile.avatar_url || meta?.avatar_url || meta?.picture || null
      );
    }

    const { data: mems } = await supabase
      .from("memories")
      .select("id, content, created_at, og_root_hash")
      .order("created_at", { ascending: false })
      .limit(100);
    if (mems) setMemories(mems as Memory[]);
  }, [user, meta]);

  useEffect(() => {
    load();
  }, [load]);

  const chooseStyle = (s: ChatStyle) => {
    setStyle(s);
    setChatStyle(s);
  };

  const forget = async (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("memories").delete().eq("id", id);
  };

  const confirmDelete = () => {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account, all chats, and transactions. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              await signOut();
              router.replace("/login");
            } catch (e) {
              Alert.alert("Failed", (e as Error).message);
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) return null;
  if (!session) return <Redirect href="/login" />;

  const initials = (user?.email?.slice(0, 2) || "AZ").toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Profile hero */}
        <View style={styles.hero}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.heroAvatar} />
          ) : (
            <View style={[styles.heroAvatar, styles.heroFallback]}>
              <Text style={styles.heroInitials}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName} numberOfLines={1}>
              {displayName || user?.email?.split("@")[0] || "—"}
            </Text>
            <Text style={styles.heroEmail} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </View>

        {/* Balance */}
        <Section title="Account">
          <Row title="Balance" subtitle="Available credits">
            <Text style={styles.value}>
              {balance != null
                ? `${formatBalance(balance)} · ${balance.toLocaleString()}c`
                : "—"}
            </Text>
          </Row>
          <Pressable onPress={() => router.push("/deposit")}>
            <Row title="Add credits" subtitle="Top up via Paystack">
              <Text style={styles.link}>Deposit →</Text>
            </Row>
          </Pressable>
        </Section>

        {/* Currency */}
        <Section title="Preferences">
          <Row title="Display currency" subtitle="How balances are shown">
            <Segmented<DisplayCurrency>
              value={currency}
              options={[
                { value: "USD", label: "$" },
                { value: "NGN", label: "₦" },
              ]}
              onChange={setCurrency}
            />
          </Row>
        </Section>

        {/* Chat style */}
        <Section title="Chat style">
          {CHAT_STYLES.map((s) => (
            <Pressable key={s.id} onPress={() => chooseStyle(s.id)}>
              <Row title={s.label} subtitle={s.description}>
                <View style={[styles.radio, style === s.id && styles.radioOn]}>
                  {style === s.id && <View style={styles.radioDot} />}
                </View>
              </Row>
            </Pressable>
          ))}
        </Section>

        {/* Memory */}
        <Section title={`Memory${memories.length ? ` · ${memories.length}` : ""}`}>
          {memories.length === 0 ? (
            <View style={styles.rowInner}>
              <Text style={styles.subtitle}>
                Nothing remembered yet. As you chat, AskZero notes durable facts.
              </Text>
            </View>
          ) : (
            memories.map((m) => (
              <View key={m.id} style={styles.memRow}>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.memText}>{m.content}</Text>
                  {m.og_root_hash && (
                    <View style={styles.memBadge}>
                      <ShieldCheck size={12} color={colors.success} />
                      <Text style={styles.memBadgeText}>On 0G</Text>
                    </View>
                  )}
                </View>
                <Pressable onPress={() => forget(m.id)} hitSlop={8}>
                  <Trash2 size={16} color={colors.textTertiary} />
                </Pressable>
              </View>
            ))
          )}
        </Section>

        {/* Actions */}
        <Pressable style={styles.signOut} onPress={() => { signOut(); router.replace("/login"); }}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <Pressable style={styles.delete} onPress={confirmDelete} disabled={deleting}>
          {deleting ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <Text style={styles.deleteText}>Delete account</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.rowInner}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, on && styles.segItemOn]}
          >
            <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  back: { width: 22 },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  scroll: { padding: 16, gap: 22, paddingBottom: 48 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  heroAvatar: { width: 54, height: 54, borderRadius: 27 },
  heroFallback: {
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInitials: { color: colors.accentBright, fontSize: 16, fontWeight: "700" },
  heroName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  heroEmail: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  section: { gap: 8 },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  sectionBody: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  rowTitle: { color: colors.text, fontSize: 14.5, fontWeight: "600" },
  subtitle: { color: colors.textTertiary, fontSize: 12, marginTop: 2, lineHeight: 17 },
  value: { color: colors.text, fontSize: 13, fontWeight: "600" },
  link: { color: colors.accentBright, fontSize: 13, fontWeight: "600" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.accent },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  memRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  memText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  memBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  memBadgeText: { color: colors.textTertiary, fontSize: 10, fontWeight: "600" },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 2,
  },
  segItem: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8 },
  segItemOn: { backgroundColor: colors.card },
  segText: { color: colors.textTertiary, fontSize: 13, fontWeight: "700" },
  segTextOn: { color: colors.text },
  signOut: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  signOutText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  delete: {
    borderWidth: 1,
    borderColor: "rgba(255,92,92,0.3)",
    backgroundColor: "rgba(255,92,92,0.06)",
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteText: { color: colors.error, fontSize: 15, fontWeight: "600" },
});
