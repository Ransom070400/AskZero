import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from "react-native";
import { ShieldCheck, X, ExternalLink, Check } from "lucide-react-native";
import { useTheme } from "@/lib/theme-context";
import { getReceipt, type ReceiptData } from "@/lib/api";
import { radius, type Palette } from "@/lib/theme";

const DEFAULT_EXPLORER = "https://chainscan.0g.ai";

const short = (v: string) =>
  v && v.length > 18 ? `${v.slice(0, 10)}…${v.slice(-8)}` : v;

export function ReceiptBadge({ messageId }: { messageId: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ReceiptData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "none" | "error">("idle");

  const load = async () => {
    setOpen(true);
    if (data || state === "loading") return;
    setState("loading");
    try {
      const r = await getReceipt(messageId);
      if (!r) return setState("none");
      setData(r);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  const anchored = !!data?.batch?.tx_hash;
  const txUrl = data?.batch?.tx_hash
    ? data.explorerUrl || `${DEFAULT_EXPLORER}/tx/${data.batch.tx_hash}`
    : null;

  return (
    <>
      <Pressable style={styles.badge} onPress={load} hitSlop={6}>
        <ShieldCheck size={12} color={colors.textTertiary} />
        <Text style={styles.badgeText}>Verify on 0G</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.center} pointerEvents="box-none">
          <View style={styles.sheet}>
            <View style={styles.header}>
              <ShieldCheck size={18} color={anchored ? colors.success : colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  {anchored ? "Verified on 0G" : "Inference receipt"}
                </Text>
                <Text style={styles.subtitle}>Tamper-evident proof of this answer</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <X size={18} color={colors.textTertiary} />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: 440 }}
              contentContainerStyle={{ padding: 16, gap: 16 }}
            >
              {state === "loading" && (
                <ActivityIndicator color={colors.accent} style={{ paddingVertical: 24 }} />
              )}
              {state === "none" && (
                <Text style={styles.muted}>
                  No receipt was recorded for this message.
                </Text>
              )}
              {state === "error" && (
                <Text style={[styles.muted, { color: colors.error }]}>
                  Couldn&apos;t load the receipt.
                </Text>
              )}

              {data && (
                <>
                  <Text style={styles.blurb}>
                    AskZero fingerprints this answer&apos;s inputs and outputs and
                    anchors the hash on the 0G chain, so it can&apos;t be altered
                    after the fact.
                  </Text>

                  <Group label="Status" styles={styles}>
                    <StatusRow ok label="Receipt created" styles={styles} colors={colors} />
                    {anchored ? (
                      <StatusRow
                        ok
                        label="Anchored on-chain"
                        note={data.batch?.block_number ? `block ${data.batch.block_number}` : undefined}
                        styles={styles}
                        colors={colors}
                      />
                    ) : (
                      <StatusRow
                        label="On-chain anchor"
                        note="pending next batch (anchored hourly)"
                        styles={styles}
                        colors={colors}
                      />
                    )}
                    {data.receipt.tee_attestation && (
                      <StatusRow ok label="TEE attestation present" styles={styles} colors={colors} />
                    )}
                  </Group>

                  <Group label="Model" styles={styles}>
                    <KV k="Provider" v={data.receipt.provider} styles={styles} />
                    <KV k="Model" v={data.receipt.model} styles={styles} />
                    <KV
                      k="Tokens"
                      v={`${data.receipt.input_tokens} in · ${data.receipt.output_tokens} out · ${data.receipt.cost_credits}c`}
                      styles={styles}
                    />
                  </Group>

                  <Group label="Cryptographic proof" styles={styles}>
                    <KV k="Input hash" v={short(data.receipt.input_hash)} mono styles={styles} />
                    <KV k="Output hash" v={short(data.receipt.output_hash)} mono styles={styles} />
                    <KV
                      k={
                        data.receipt.leaf_index != null
                          ? `Receipt (leaf #${data.receipt.leaf_index})`
                          : "Receipt hash"
                      }
                      v={short(data.receipt.receipt_hash)}
                      mono
                      styles={styles}
                    />
                    {data.batch && (
                      <KV k="Merkle root" v={short(data.batch.merkle_root)} mono styles={styles} />
                    )}
                  </Group>

                  {data.batch && (
                    <Group label="On-chain" styles={styles}>
                      <KV k="Chain" v={`${data.batch.chain_id} (0G)`} styles={styles} />
                      <KV k="Registry" v={short(data.batch.contract_addr)} mono styles={styles} />
                      {data.batch.tx_hash && (
                        <KV k="Anchor tx" v={short(data.batch.tx_hash)} mono styles={styles} />
                      )}
                    </Group>
                  )}

                  {txUrl && (
                    <Pressable style={styles.link} onPress={() => Linking.openURL(txUrl)}>
                      <ExternalLink size={14} color={colors.accentBright} />
                      <Text style={styles.linkText}>View transaction on 0G explorer</Text>
                    </Pressable>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Group({
  label,
  children,
  styles,
}: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={{ gap: 6 }}>{children}</View>
    </View>
  );
}

function KV({
  k,
  v,
  mono,
  styles,
}: {
  k: string;
  v: string;
  mono?: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvKey}>{k}</Text>
      <Text style={[styles.kvVal, mono && styles.mono]} numberOfLines={1}>
        {v}
      </Text>
    </View>
  );
}

function StatusRow({
  ok,
  label,
  note,
  styles,
  colors,
}: {
  ok?: boolean;
  label: string;
  note?: string;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, ok && { backgroundColor: colors.success + "26" }]}>
        {ok ? <Check size={10} color={colors.success} /> : null}
      </View>
      <Text style={styles.statusLabel}>{label}</Text>
      {note && <Text style={styles.statusNote}>· {note}</Text>}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3 },
    badgeText: { color: colors.textTertiary, fontSize: 11, fontWeight: "600" },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
    sheet: {
      width: "100%",
      maxWidth: 460,
      backgroundColor: colors.elevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    title: { color: colors.text, fontSize: 15, fontWeight: "700" },
    subtitle: { color: colors.textTertiary, fontSize: 11 },
    blurb: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
    groupLabel: {
      color: colors.textTertiary,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    kv: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    kvKey: { color: colors.textTertiary, fontSize: 13 },
    kvVal: { color: colors.text, fontSize: 13, fontWeight: "500", flexShrink: 1, textAlign: "right" },
    mono: { fontFamily: "Menlo", fontSize: 12 },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    statusDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    statusLabel: { color: colors.text, fontSize: 13 },
    statusNote: { color: colors.textTertiary, fontSize: 13 },
    muted: { color: colors.textSecondary, fontSize: 13, textAlign: "center", paddingVertical: 24 },
    link: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-start",
      backgroundColor: colors.accent + "1F",
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    linkText: { color: colors.accentBright, fontSize: 13, fontWeight: "700" },
  });
