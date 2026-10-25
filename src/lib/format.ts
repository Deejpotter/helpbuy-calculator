export const aud = (n: number, opts?: { exact?: boolean }) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: opts?.exact ? 2 : 0,
    maximumFractionDigits: opts?.exact ? 2 : 0,
  }).format(n);

export const num = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-AU", { maximumFractionDigits: digits }).format(n);

export const pct = (n: number, digits = 1) => `${num(n * 100, digits)}%`;

export const parseMoney = (s: string): number => {
  const clean = s.replace(/[$,\s]/g, "");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
};

export const parsePct = (s: string): number => {
  const n = Number(s.replace(/[%,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export const num0 = (n: number): string => (Number.isFinite(n) ? String(Math.round(n)) : "0");
export const numPrec = (n: number, d = 2): string =>
  Number.isFinite(n) ? String(Number(n.toFixed(d))) : "0";

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export const roundTo = (x: number, step: number) => Math.round(x / step) * step;

/** Compact money for chart labels: $130.7B, $96.2M, $1.6M, $481k, -$1.5M. */
export function moneyShort(v: number): string {
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  const trim = (n: number) => Number(n.toFixed(1)).toLocaleString("en-AU");
  if (a >= 1e9) return `${sign}$${trim(a / 1e9)}B`;
  if (a >= 1e6) return `${sign}$${trim(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3).toLocaleString("en-AU")}k`;
  return `${sign}$${Math.round(a).toLocaleString("en-AU")}`;
}
