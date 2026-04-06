"use client";

import { createContext, useContext, useState, useEffect } from "react";

type Currency = "NGN" | "USD";

const NGN_PER_USD = 1500;
const CREDITS_PER_USD = 1000;

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatBalance: (credits: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "USD",
  setCurrency: () => {},
  formatBalance: () => "—",
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD");

  useEffect(() => {
    const saved = localStorage.getItem("askzero-currency");
    if (saved === "NGN" || saved === "USD") setCurrencyState(saved);
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem("askzero-currency", c);
  };

  const formatBalance = (credits: number): string => {
    const usd = credits / CREDITS_PER_USD;
    if (currency === "NGN") {
      const ngn = usd * NGN_PER_USD;
      return `₦${ngn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${usd.toFixed(2)}`;
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
