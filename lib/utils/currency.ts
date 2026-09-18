export const CURRENCIES = [
  "INR",
  "USD",
  "AED",
  "GBP",
  "EUR",
  "SGD",
  "AUD",
  "CAD",
  "JPY",
  "NZD",
  "CHF",
  "HKD",
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
  AED: "en-AE",
  GBP: "en-GB",
  EUR: "en-IE",
  SGD: "en-SG",
  AUD: "en-AU",
  CAD: "en-CA",
  JPY: "ja-JP",
  NZD: "en-NZ",
  CHF: "de-CH",
  HKD: "en-HK",
};

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function getCurrencyCode(value: string): string {
  return value.trim().toUpperCase();
}

export function localeForCurrency(currency: string): string {
  const code = getCurrencyCode(currency);
  if (isCurrencyCode(code)) {
    return CURRENCY_LOCALES[code];
  }
  return "en-US";
}

export type FormatCurrencyOptions = {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

/**
 * Locale-aware currency formatting. Symbols come from Intl — never hard-code them.
 */
export function formatCurrency(
  amount: number,
  currency: string,
  options: FormatCurrencyOptions = {},
): string {
  const code = getCurrencyCode(currency);
  const locale = options.locale ?? localeForCurrency(code);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits: options.maximumFractionDigits,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

export function getCurrencySymbol(currency: string, locale?: string): string {
  const code = getCurrencyCode(currency);
  const resolvedLocale = locale ?? localeForCurrency(code);

  try {
    const parts = new Intl.NumberFormat(resolvedLocale, {
      style: "currency",
      currency: code,
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}
