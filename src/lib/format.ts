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
