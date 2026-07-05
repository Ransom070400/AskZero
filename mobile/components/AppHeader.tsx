import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Menu } from "lucide-react-native";
import { Logo } from "./Logo";
import { radius, type Palette } from "@/lib/theme";
import { useTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { getBalance } from "@/lib/api";

// Header shared across authenticated screens. Optional menu (chat history),
// balance pill → deposit, avatar → settings. Mirrors the web top-nav.
export function AppHeader({
  balance,
  onMenu,
}: {
  balance?: number | null;
  onMenu?: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useAuth();
  const { formatBalance } = useCurrency();
  const [localBalance, setLocalBalance] = useState<number | null>(
    balance ?? null
  );

  const refresh = useCallback(() => {
    getBalance()
      .then(setLocalBalance)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (balance == null) refresh();
    else setLocalBalance(balance);
  }, [balance, refresh]);

  const meta = session?.user?.user_metadata as
    | { avatar_url?: string; picture?: string }
    | undefined;
  const avatarUrl = meta?.avatar_url || meta?.picture;
  const email = session?.user?.email ?? "";
  const initials = (email.slice(0, 2) || "AZ").toUpperCase();

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        {onMenu && (
          <Pressable onPress={onMenu} hitSlop={8} style={styles.menuBtn}>
            <Menu size={22} color={colors.text} />
          </Pressable>
        )}
        <Logo size={20} />
      </View>
      <View style={styles.right}>
        <Pressable
          style={styles.balancePill}
          onPress={() => router.push("/deposit")}
          hitSlop={6}
        >
          <Text style={styles.plus}>+</Text>
          <Text style={styles.balanceText}>
            {localBalance != null ? formatBalance(localBalance) : "—"}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push("/settings")} hitSlop={6}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuBtn: { padding: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 10 },
  balancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  plus: { color: colors.accentBright, fontSize: 14, fontWeight: "700" },
  balanceText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: {
    backgroundColor: colors.elevated,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
});
