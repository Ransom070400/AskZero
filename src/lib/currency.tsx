"use client";

import { createContext, useContext, useState, useEffect } from "react";

type Currency = "NGN" | "USD";

const CREDITS_PER_USD = 1000;
const FALLBACK_RATE = 1500;

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
  const [ngnPerUsd, setNgnPerUsd] = useState(FALLBACK_RATE);

  useEffect(() => {
    const saved = localStorage.getItem("askzero-currency");
    if (saved === "NGN" || saved === "USD") setCurrencyState(saved);
  }, []);

  // Fetch live rate
  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json())
      .then((data) => { if (data.rate) setNgnPerUsd(data.rate); })
      .catch(() => {});
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem("askzero-currency", c);
  };

  const formatBalance = (credits: number): string => {
    const usd = credits / CREDITS_PER_USD;
    if (currency === "NGN") {
      const ngn = usd * ngnPerUsd;
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
