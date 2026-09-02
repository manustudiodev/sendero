export const supportedCurrencies = [
  "USD",
  "EUR",
  "GBP",
  "ARS",
  "BRL",
  "CAD",
  "AUD",
  "NZD",
  "MXN",
  "CLP",
  "COP",
  "PEN",
  "UYU",
  "CHF",
  "JPY",
  "CNY",
  "HKD",
  "SGD",
  "KRW",
  "INR",
  "AED",
  "TRY",
  "ZAR",
];

function localeNumberParts(locale) {
  try {
    const parts = new Intl.NumberFormat(locale || "en").formatToParts(12345.6);
    return {
      decimal: parts.find((part) => part.type === "decimal")?.value || ".",
      group: parts.find((part) => part.type === "group")?.value || ",",
    };
  } catch {
    return { decimal: ".", group: "," };
  }
}

export function normalizeLocalizedAmountInput(input, locale = "en") {
  const { decimal, group } = localeNumberParts(locale);
  let normalized = String(input ?? "").replace(/[\s\u00a0\u202f]/gu, "");
  if (group && group !== decimal) normalized = normalized.split(group).join("");

  const decimalIndex = normalized.indexOf(decimal);
  const integerSource = decimalIndex >= 0 ? normalized.slice(0, decimalIndex) : normalized;
  const fractionSource = decimalIndex >= 0 ? normalized.slice(decimalIndex + decimal.length) : "";
  const integerDigits = integerSource.replace(/\D/gu, "");
  const fractionDigits = fractionSource.replace(/\D/gu, "").slice(0, 2);

  if (!integerDigits && !fractionDigits) return "";
  const integer = integerDigits.replace(/^0+(?=\d)/u, "") || "0";
  return decimalIndex >= 0 ? `${integer}.${fractionDigits}` : integer;
}

export function formatLocalizedAmountInput(amount, locale = "en") {
  const canonical = String(amount ?? "");
  if (!canonical) return "";
  const match = canonical.match(/^(\d+)(?:\.(\d{0,2}))?$/u);
  if (!match) return canonical;

  let formattedInteger;
  try {
    formattedInteger = new Intl.NumberFormat(locale || "en", {
      maximumFractionDigits: 0,
      useGrouping: true,
    }).format(BigInt(match[1]));
  } catch {
    formattedInteger = match[1];
  }

  if (!canonical.includes(".")) return formattedInteger;
  return `${formattedInteger}${localeNumberParts(locale).decimal}${match[2] ?? ""}`;
}

export function currencyOptionLabel(currency, locale = "en") {
  let name = currency;
  let symbol = currency;
  try {
    name = new Intl.DisplayNames([locale || "en"], { type: "currency" }).of(currency) || currency;
    name = `${name.charAt(0).toLocaleUpperCase(locale || "en")}${name.slice(1)}`;
    symbol = new Intl.NumberFormat(locale || "en", {
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
      style: "currency",
    }).formatToParts(0).find((part) => part.type === "currency")?.value || currency;
  } catch {
    // The ISO code remains a safe label if an older runtime lacks Intl.DisplayNames.
  }
  return `${name} (${symbol})`;
}
