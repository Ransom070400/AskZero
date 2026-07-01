import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";

export type DisplayCurrency = "NGN" | "USD";

const CREDITS_PER_USD = 1000;
const FALLBACK_NGN_RATE = 1500;
const STORE_KEY = "askzero-currency";
const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface CurrencyContextType {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  ngnPerUsd: number;
  formatBalance: (credits: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "USD",
  setCurrency: () => {},
  ngnPerUsd: FALLBACK_NGN_RATE,
  formatBalance: () => "—",
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("USD");
  const [ngnPerUsd, setNgnPerUsd] = useState(FALLBACK_NGN_RATE);

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY).then((saved) => {
      if (saved === "NGN" || saved === "USD") setCurrencyState(saved);
    });
    fetch(`${API_URL}/api/exchange-rate`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.rate) setNgnPerUsd(d.rate);
      })
      .catch(() => {});
  }, []);

  const setCurrency = (c: DisplayCurrency) => {
    setCurrencyState(c);
    SecureStore.setItemAsync(STORE_KEY, c).catch(() => {});
  };

  const formatBalance = (credits: number): string => {
    const usd = credits / CREDITS_PER_USD;
    if (currency === "USD") return `$${usd.toFixed(2)}`;
    const ngn = usd * ngnPerUsd;
    return `₦${ngn.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, ngnPerUsd, formatBalance }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
