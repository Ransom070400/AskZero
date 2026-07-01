import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import { Plus, X, MessageSquare, Paperclip, Mic, Square } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import { useAuth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { getChatStyle } from "@/lib/prefs";
import { colors } from "@/lib/theme";
import {
  createChat,
  getBalance,
  getDefaultChatModel,
  getChatMessages,
  listChats,
  streamChat,
  uploadFile,
  transcribeAudio,
  generateImage,
  detectImageIntent,
  type ChatSummary,
  type Attachment,
} from "@/lib/api";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

export default function Chat() {
  const { session, loading } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busyAttach, setBusyAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const chatIdRef = useRef<string | null>(null);
  const modelRef = useRef<{ provider: string; model: string } | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const ensureChatId = useCallback(async () => {
    if (!chatIdRef.current) chatIdRef.current = await createChat();
    return chatIdRef.current;
  }, []);

  const attach = useCallback(
    async (file: { uri: string; name: string; mimeType: string }) => {
      setBusyAttach(true);
      try {
        const chatId = await ensureChatId();
        const a = await uploadFile(chatId, file);
        setAttachments((prev) => [...prev, a]);
      } catch (e) {
        Alert.alert("Upload failed", (e as Error).message);
      } finally {
        setBusyAttach(false);
      }
    },
    [ensureChatId]
  );

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    await attach({
      uri: a.uri,
      name: a.fileName ?? `image-${Date.now()}.jpg`,
      mimeType: a.mimeType ?? "image/jpeg",
    });
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    await attach({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? "application/pdf" });
  };

  const chooseAttachment = () => {
    Alert.alert("Attach", "", [
      { text: "Photo", onPress: pickImage },
      { text: "PDF", onPress: pickDocument },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const toggleRecording = async () => {
    if (recording) {
      await recorder.stop();
      setRecording(false);
      const uri = recorder.uri;
      if (!uri) return;
      setBusyAttach(true);
      try {
        const text = await transcribeAudio({
          uri,
          name: "recording.m4a",
          mimeType: "audio/m4a",
        });
        if (text) setInput((prev) => (prev ? prev + " " : "") + text);
      } catch (e) {
        Alert.alert("Transcription failed", (e as Error).message);
      } finally {
        setBusyAttach(false);
      }
    } else {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Microphone access needed", "Enable it in Settings to use voice.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    }
  };

  const refreshBalance = useCallback(() => {
    getBalance()
      .then(setBalance)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    refreshBalance();
    getDefaultChatModel().then((m) => (modelRef.current = m));
  }, [session, refreshBalance]);

  const openHistory = () => {
    setHistoryOpen(true);
    listChats()
      .then(setChats)
      .catch(() => {});
  };

  const newChat = () => {
    chatIdRef.current = null;
    setMessages([]);
    setHistoryOpen(false);
  };

  const selectChat = async (id: string) => {
    setHistoryOpen(false);
    if (id === chatIdRef.current) return;
    setLoadingChat(true);
    chatIdRef.current = id;
    try {
      const stored = await getChatMessages(id);
      setMessages(stored.map((m) => ({ id: m.id, role: m.role, content: m.content })));
    } catch {
      setMessages([]);
    } finally {
      setLoadingChat(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || sending) return;
    const outgoing = attachments;
    setInput("");
    setAttachments([]);
    setSending(true);

    const userMsg: Msg = { id: nextId(), role: "user", content: text };
    const assistantMsg: Msg = { id: nextId(), role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const setAssistant = (patch: Partial<Msg>) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, ...patch } : m))
      );

    try {
      const chatId = await ensureChatId();

      // "Make me an image" → route to image generation instead of chat.
      if (outgoing.length === 0 && detectImageIntent(text)) {
        const { imageUrl } = await generateImage(chatId, text);
        setAssistant({ imageUrl, content: "" });
        return;
      }

      const model = modelRef.current ?? (await getDefaultChatModel());
      const style = await getChatStyle();

      await streamChat(
        {
          chatId,
          message: text,
          provider: model.provider,
          model: model.model,
          style,
          attachments: outgoing.length ? outgoing : undefined,
        },
        (chunk) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m
            )
          )
      );
    } catch (e) {
      setAssistant({ content: `⚠️ ${(e as Error).message}` });
    } finally {
      setSending(false);
      refreshBalance();
    }
  };

  if (loading) return null;
  if (!session) return <Redirect href="/login" />;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppHeader balance={balance} onMenu={openHistory} />

      <HistoryDrawer
        visible={historyOpen}
        chats={chats}
        activeId={chatIdRef.current}
        onClose={() => setHistoryOpen(false)}
        onNew={newChat}
        onSelect={selectChat}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        {loadingChat ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.accentBright} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Ask anything.</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            renderItem={({ item }) => {
              if (item.imageUrl) {
                return (
                  <View style={[styles.bubble, styles.aiBubble, styles.imageBubble]}>
                    <Image source={{ uri: item.imageUrl }} style={styles.genImage} />
                  </View>
                );
              }
              return (
                <View
                  style={[
                    styles.bubble,
                    item.role === "user" ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  {item.content === "" ? (
                    <ActivityIndicator color="#CB8AFF" />
                  ) : (
                    <Text
                      style={item.role === "user" ? styles.userText : styles.aiText}
                    >
                      {item.content}
                    </Text>
                  )}
                </View>
              );
            }}
          />
        )}

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <View style={styles.chips}>
            {attachments.map((a) => (
              <View key={a.url} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {a.name}
                </Text>
                <Pressable
                  onPress={() =>
                    setAttachments((prev) => prev.filter((x) => x.url !== a.url))
                  }
                  hitSlop={6}
                >
                  <X size={13} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Composer */}
        <View style={styles.composer}>
          <Pressable
            onPress={chooseAttachment}
            disabled={busyAttach || sending}
            hitSlop={6}
            style={styles.iconBtn}
          >
            <Paperclip size={20} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={toggleRecording}
            disabled={busyAttach || sending}
            hitSlop={6}
            style={styles.iconBtn}
          >
            {recording ? (
              <Square size={18} color={colors.error} fill={colors.error} />
            ) : (
              <Mic size={20} color={colors.textSecondary} />
            )}
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder={recording ? "Recording…" : "Message AskZero…"}
            placeholderTextColor="#666"
            value={input}
            onChangeText={setInput}
            multiline
            editable={!sending}
          />
          <Pressable
            style={[
              styles.sendBtn,
              (!input.trim() && attachments.length === 0) || sending
                ? styles.disabled
                : null,
            ]}
            onPress={send}
            disabled={(!input.trim() && attachments.length === 0) || sending}
          >
            {busyAttach ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.sendBtnText}>{sending ? "…" : "↑"}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HistoryDrawer({
  visible,
  chats,
  activeId,
  onClose,
  onNew,
  onSelect,
}: {
  visible: boolean;
  chats: ChatSummary[];
  activeId: string | null;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={drawer.backdrop} onPress={onClose} />
      <SafeAreaView style={drawer.panel} edges={["top", "bottom"]}>
        <View style={drawer.head}>
          <Text style={drawer.title}>Chats</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Pressable style={drawer.newBtn} onPress={onNew}>
          <Plus size={18} color={colors.text} />
          <Text style={drawer.newText}>New chat</Text>
        </Pressable>

        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={drawer.empty}>No chats yet.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[drawer.row, item.id === activeId && drawer.rowActive]}
              onPress={() => onSelect(item.id)}
            >
              <MessageSquare size={15} color={colors.textTertiary} />
              <Text style={drawer.rowText} numberOfLines={1}>
                {item.title || "New chat"}
              </Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const drawer = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  panel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "82%",
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevated,
  },
  newText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  rowActive: { backgroundColor: colors.elevated },
  rowText: { color: colors.text, fontSize: 14, flex: 1 },
  empty: { color: colors.textTertiary, fontSize: 13, textAlign: "center", marginTop: 24 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  brand: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  balance: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" },
  signOut: { color: "#CB8AFF", fontSize: 13, fontWeight: "600" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "rgba(255,255,255,0.35)", fontSize: 17 },
  list: { padding: 16, gap: 10 },
  bubble: { maxWidth: "88%", borderRadius: 18, paddingHorizontal: 15, paddingVertical: 11 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#fff" },
  aiBubble: { alignSelf: "flex-start", backgroundColor: "#161616" },
  userText: { color: "#000", fontSize: 15.5, lineHeight: 22 },
  aiText: { color: "#ededed", fontSize: 15.5, lineHeight: 22 },
  imageBubble: { padding: 4, maxWidth: "80%" },
  genImage: { width: 240, height: 240, borderRadius: 14, backgroundColor: "#0d0d0d" },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: 180,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
  },
  chipText: { color: "#ededed", fontSize: 12, flexShrink: 1 },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    color: "#fff",
    fontSize: 16,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#CB8AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: { color: "#000", fontSize: 20, fontWeight: "800" },
  disabled: { opacity: 0.4 },
});
