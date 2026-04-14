import { USD_TO_CREDITS_RATE } from "@/lib/pricing";

/**
 * APAC test-mode currency support for Stripe Checkout.
 * Rates are fallback/approximate — used only to compute credits for a deposit
 * when Stripe's Checkout session is created. They should be refreshed
 * periodically against a live FX API in production.
 */

export type ApacCurrency =
  | "JPY"
  | "SGD"
  | "HKD"
  | "AUD"
  | "NZD"
  | "MYR"
  | "THB"
  | "KRW"
  | "PHP"
  | "IDR"
  | "INR"
  | "VND"
  | "TWD";

export interface ApacCurrencyMeta {
  code: ApacCurrency;
  label: string;
  symbol: string;
  country: string;
  /** Approximate units per 1 USD — used for credit estimation. */
  perUsd: number;
  /** Zero-decimal Stripe currencies: amount passed to Stripe is whole units. */
  zeroDecimal: boolean;
  presets: number[];
}

export const APAC_CURRENCIES: Record<ApacCurrency, ApacCurrencyMeta> = {
  JPY: { code: "JPY", label: "Japanese yen",     symbol: "¥", country: "Japan",       perUsd: 150,    zeroDecimal: true,  presets: [500, 1500, 3000, 7500] },
  SGD: { code: "SGD", label: "Singapore dollar", symbol: "S$", country: "Singapore",  perUsd: 1.35,   zeroDecimal: false, presets: [5, 15, 30, 75] },
  HKD: { code: "HKD", label: "Hong Kong dollar", symbol: "HK$", country: "Hong Kong", perUsd: 7.8,    zeroDecimal: false, presets: [25, 75, 150, 400] },
  AUD: { code: "AUD", label: "Australian dollar",symbol: "A$", country: "Australia",  perUsd: 1.53,   zeroDecimal: false, presets: [5, 15, 30, 75] },
  NZD: { code: "NZD", label: "New Zealand dollar",symbol: "NZ$", country: "New Zealand",perUsd: 1.66, zeroDecimal: false, presets: [5, 15, 30, 75] },
  MYR: { code: "MYR", label: "Malaysian ringgit",symbol: "RM", country: "Malaysia",   perUsd: 4.7,    zeroDecimal: false, presets: [10, 25, 50, 150] },
  THB: { code: "THB", label: "Thai baht",        symbol: "฿", country: "Thailand",    perUsd: 36,     zeroDecimal: false, presets: [100, 300, 600, 1500] },
  KRW: { code: "KRW", label: "South Korean won", symbol: "₩", country: "South Korea", perUsd: 1400,   zeroDecimal: true,  presets: [5000, 15000, 30000, 75000] },
  PHP: { code: "PHP", label: "Philippine peso",  symbol: "₱", country: "Philippines", perUsd: 58,     zeroDecimal: false, presets: [150, 400, 800, 2000] },
  IDR: { code: "IDR", label: "Indonesian rupiah",symbol: "Rp", country: "Indonesia",  perUsd: 15800,  zeroDecimal: false, presets: [50000, 150000, 300000, 750000] },
  INR: { code: "INR", label: "Indian rupee",     symbol: "₹", country: "India",       perUsd: 84,     zeroDecimal: false, presets: [250, 750, 1500, 3500] },
  VND: { code: "VND", label: "Vietnamese dong",  symbol: "₫", country: "Vietnam",     perUsd: 25000,  zeroDecimal: true,  presets: [25000, 75000, 150000, 500000] },
  TWD: { code: "TWD", label: "Taiwan dollar",    symbol: "NT$", country: "Taiwan",    perUsd: 32,     zeroDecimal: false, presets: [100, 300, 600, 1500] },
};

export const APAC_CODES = Object.keys(APAC_CURRENCIES) as ApacCurrency[];

export function isApacCurrency(code: string): code is ApacCurrency {
  return code in APAC_CURRENCIES;
}

export function apacToCredits(amount: number, code: ApacCurrency): number {
  const meta = APAC_CURRENCIES[code];
  const usd = amount / meta.perUsd;
  return Math.floor(usd * USD_TO_CREDITS_RATE);
}

export function formatApacCurrency(amount: number, code: ApacCurrency): string {
  const meta = APAC_CURRENCIES[code];
  const digits = meta.zeroDecimal ? 0 : 2;
  return `${meta.symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/**
 * Convert a user-entered display amount into the integer unit Stripe expects.
 * Zero-decimal currencies pass whole units; others use minor units (e.g. cents).
 */
export function toStripeUnitAmount(amount: number, code: ApacCurrency): number {
  const meta = APAC_CURRENCIES[code];
  return meta.zeroDecimal ? Math.round(amount) : Math.round(amount * 100);
}
