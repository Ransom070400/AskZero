"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { APAC_CURRENCIES, isApacCurrency, type ApacCurrency } from "@/lib/pricing-apac";

export type DisplayCurrency = "NGN" | "USD" | ApacCurrency;

const CREDITS_PER_USD = 1000;
const FALLBACK_NGN_RATE = 1500;

interface CurrencyContextType {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  formatBalance: (credits: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "USD",
  setCurrency: () => {},
  formatBalance: () => "—",
});

function isSupportedCurrency(value: string): value is DisplayCurrency {
  return value === "NGN" || value === "USD" || isApacCurrency(value);
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("USD");
  const [ngnPerUsd, setNgnPerUsd] = useState(FALLBACK_NGN_RATE);

  useEffect(() => {
    const saved = localStorage.getItem("askzero-currency");
    if (saved && isSupportedCurrency(saved)) setCurrencyState(saved);
  }, []);

  // Fetch live NGN rate
  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => { if (data.rate) setNgnPerUsd(data.rate); })
      .catch(() => {});
  }, []);

  const setCurrency = (c: DisplayCurrency) => {
    setCurrencyState(c);
    localStorage.setItem("askzero-currency", c);
  };

  const formatBalance = (credits: number): string => {
    const usd = credits / CREDITS_PER_USD;
    if (currency === "USD") {
      return `$${usd.toFixed(2)}`;
    }
    if (currency === "NGN") {
      const ngn = usd * ngnPerUsd;
      return `₦${ngn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const meta = APAC_CURRENCIES[currency];
    const converted = usd * meta.perUsd;
    const digits = meta.zeroDecimal ? 0 : 2;
    return `${meta.symbol}${converted.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatBalance }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
