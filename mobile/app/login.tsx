import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleEmail = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      const fn =
        mode === "signin"
          ? supabase.auth.signInWithPassword({ email: email.trim(), password })
          : supabase.auth.signUp({ email: email.trim(), password });
      const { error } = await fn;
      if (error) throw error;
      // The auth listener in AuthProvider will flip session; index redirects.
      router.replace("/chat");
    } catch (e) {
      Alert.alert("Sign in failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Google OAuth via the system browser + deep link back into the app.
  // Requires the app scheme redirect (askzero://) to be allowlisted in the
  // Supabase Auth "Redirect URLs" settings.
  const handleGoogle = async () => {
    setBusy(true);
    try {
      const redirectTo = Linking.createURL("auth-callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error("No OAuth URL returned");

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") return;

      // The return URL may carry a PKCE `code` (query) OR tokens in the fragment,
      // depending on the Supabase flow — handle both.
      const returnUrl = result.url;
      const code = Linking.parse(returnUrl).queryParams?.code as string | undefined;

      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) throw exErr;
      } else {
        const hash = returnUrl.includes("#") ? returnUrl.split("#")[1] : "";
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (setErr) throw setErr;
        } else {
          throw new Error("No session returned from Google");
        }
      }
      router.replace("/chat");
    } catch (e) {
      Alert.alert("Google sign-in failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>askzero</Text>
          <Text style={styles.tagline}>private, verifiable AI.</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={[styles.primaryBtn, busy && styles.disabled]}
            onPress={handleEmail}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === "signin" ? "Sign in" : "Create account"}
              </Text>
            )}
          </Pressable>

          <Pressable style={styles.googleBtn} onPress={handleGoogle} disabled={busy}>
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </Pressable>

          <Pressable
            onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            <Text style={styles.switch}>
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  header: { alignItems: "center", marginBottom: 40 },
  brand: { color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -1 },
  tagline: { color: "rgba(255,255,255,0.5)", fontSize: 15, marginTop: 8 },
  form: { gap: 12 },
  input: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 16,
  },
  primaryBtn: {
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  googleBtn: {
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: "center",
  },
  googleBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  switch: {
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 8,
    fontSize: 13,
  },
  disabled: { opacity: 0.6 },
});
