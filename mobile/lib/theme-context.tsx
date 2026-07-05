import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { darkColors, lightColors, type Palette } from "./theme";

export type ThemePref = "light" | "dark" | "system";
const KEY = "askzero-theme";

interface ThemeCtx {
  colors: Palette;
  scheme: "light" | "dark";
  preference: ThemePref;
  setPreference: (p: ThemePref) => void;
}

const Ctx = createContext<ThemeCtx>({
  colors: darkColors,
  scheme: "dark",
  preference: "system",
  setPreference: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePref>("system");

  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((v) => {
      if (v === "light" || v === "dark" || v === "system") setPref(v);
    });
  }, []);

  const setPreference = (p: ThemePref) => {
    setPref(p);
    SecureStore.setItemAsync(KEY, p).catch(() => {});
  };

  const scheme: "light" | "dark" =
    preference === "system"
      ? system === "light"
        ? "light"
        : "dark"
      : preference;
  const colors = scheme === "light" ? lightColors : darkColors;

  return (
    <Ctx.Provider value={{ colors, scheme, preference, setPreference }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
