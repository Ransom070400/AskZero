import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth";
import { CurrencyProvider } from "@/lib/currency";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CurrencyProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#000" },
              animation: "fade",
            }}
          />
        </CurrencyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
