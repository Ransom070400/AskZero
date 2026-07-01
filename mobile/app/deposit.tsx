import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ChevronLeft } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { useCurrency, type DisplayCurrency } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import { getBalance, initializeDeposit, verifyDeposit } from "@/lib/api";
import { colors, radius } from "@/lib/theme";

interface Tx {
  id: string;
  original_amount: number;
  currency: string;
  status: string;
  created_at: string;
  type: string;
}

const PRESETS: Record<DisplayCurrency, number[]> = {
  USD: [1, 5, 10, 25],
  NGN: [500, 1000, 2000, 5000],
};

export default function Deposit() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { currency, setCurrency, formatBalance, ngnPerUsd } = useCurrency();

  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [busy, setBusy] = useState(false);

  const payCurrency: DisplayCurrency = currency === "NGN" ? "NGN" : "USD";
  const symbol = payCurrency === "NGN" ? "₦" : "$";

  const refresh = useCallback(async () => {
    getBalance().then(setBalance).catch(() => {});
    if (!session?.user) return;
    const { data } = await supabase
      .from("transactions")
      .select("id, original_amount, currency, status, created_at, type")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setTxs(data as Tx[]);
  }, [session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const chosen = amount ?? (custom ? Number(custom) : 0);
  const creditsEstimate =
    payCurrency === "USD"
      ? Math.round(chosen * 1000)
      : Math.round((chosen / ngnPerUsd) * 1000);

  const pay = async () => {
    if (!chosen || chosen <= 0) return;
    setBusy(true);
    try {
      const { authorization_url, reference } = await initializeDeposit(
        chosen,
        payCurrency
      );
      await WebBrowser.openBrowserAsync(authorization_url);
      // On return, verify (webhook is canonical; this is the sync fallback).
      const result = await verifyDeposit(reference);
      if (result.status === "completed") {
        Alert.alert("Success", "Your credits have been added.");
      } else {
        Alert.alert(
          "Payment pending",
          "If you completed payment, your balance will update shortly."
        );
      }
      setAmount(null);
      setCustom("");
      await refresh();
    } catch (e) {
      Alert.alert("Deposit failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 22 }}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Add credits</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current balance</Text>
          <Text style={styles.balanceValue}>
            {balance != null ? formatBalance(balance) : "—"}
          </Text>
          {balance != null && (
            <Text style={styles.balanceCredits}>
              {balance.toLocaleString()} credits
            </Text>
          )}
        </View>

        {/* Currency */}
        <View style={styles.segmented}>
          {(["USD", "NGN"] as DisplayCurrency[]).map((c) => {
            const on = payCurrency === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCurrency(c)}
                style={[styles.segItem, on && styles.segItemOn]}
              >
                <Text style={[styles.segText, on && styles.segTextOn]}>
                  {c === "NGN" ? "₦ NGN" : "$ USD"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Presets */}
        <View style={styles.presets}>
          {PRESETS[payCurrency].map((p) => {
            const on = amount === p && !custom;
            return (
              <Pressable
                key={p}
                onPress={() => {
                  setAmount(p);
                  setCustom("");
                }}
                style={[styles.preset, on && styles.presetOn]}
              >
                <Text style={[styles.presetText, on && styles.presetTextOn]}>
                  {symbol}
                  {p.toLocaleString()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom */}
        <TextInput
          style={styles.input}
          placeholder={`Custom amount (${symbol})`}
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          value={custom}
          onChangeText={(t) => {
            setCustom(t.replace(/[^0-9.]/g, ""));
            setAmount(null);
          }}
        />

        {chosen > 0 && (
          <Text style={styles.estimate}>≈ {creditsEstimate.toLocaleString()} credits</Text>
        )}

        <Pressable
          style={[styles.payBtn, (!chosen || busy) && styles.disabled]}
          onPress={pay}
          disabled={!chosen || busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.payText}>
              Pay {symbol}
              {chosen ? chosen.toLocaleString() : ""} with Paystack
            </Text>
          )}
        </Pressable>

        {/* History */}
        {txs.length > 0 && (
          <View style={styles.history}>
            <Text style={styles.historyTitle}>Recent</Text>
            {txs.map((t) => (
              <View key={t.id} style={styles.txRow}>
                <View>
                  <Text style={styles.txAmount}>
                    {t.currency === "NGN" ? "₦" : "$"}
                    {Number(t.original_amount).toLocaleString()} · {t.type}
                  </Text>
                  <Text style={styles.txDate}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.txStatus,
                    t.status === "completed" && { color: colors.success },
                    t.status === "pending" && { color: colors.textTertiary },
                  ]}
                >
                  {t.status}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  scroll: { padding: 16, gap: 18, paddingBottom: 48 },
  balanceCard: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: "center",
    gap: 4,
  },
  balanceLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: "600" },
  balanceValue: { color: colors.text, fontSize: 30, fontWeight: "800" },
  balanceCredits: { color: colors.textSecondary, fontSize: 13 },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 3,
  },
  segItem: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  segItemOn: { backgroundColor: colors.card },
  segText: { color: colors.textTertiary, fontSize: 14, fontWeight: "700" },
  segTextOn: { color: colors.text },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  preset: {
    flexGrow: 1,
    flexBasis: "45%",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  presetOn: { borderColor: colors.accent, backgroundColor: "rgba(183,95,255,0.1)" },
  presetText: { color: colors.text, fontSize: 17, fontWeight: "700" },
  presetTextOn: { color: colors.accentBright },
  input: {
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  estimate: { color: colors.textSecondary, fontSize: 13, textAlign: "center" },
  payBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  payText: { color: colors.onAccent, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  history: { gap: 8, marginTop: 8 },
  historyTitle: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  txAmount: { color: colors.text, fontSize: 14, fontWeight: "600" },
  txDate: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  txStatus: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
});
