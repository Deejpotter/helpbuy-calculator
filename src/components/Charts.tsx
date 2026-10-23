import type { YearRow } from "../lib/engine";

/** Hand-rolled SVG equity timeline: buyer equity (area) · Commonwealth share · loan balance. */
export function EquityChart(props: { rows: YearRow[] }) {
  const { rows } = props;
  const H = 240;
  const W = 680;
  const P = { l: 64, r: 86, t: 18, b: 26 };
  const n = Math.max(1, rows.length - 1);
  const ymax = Math.max(...rows.map((r) => Math.max(r.homeValue, r.cspValue + r.buyerEquityDollar))) || 1;

  const y = (v: number) => P.t + (1 - v / ymax) * (H - P.t - P.b);
  const x = (t: number) => P.l + (t / n) * (W - P.l - P.r);
  const path = (get: (r: YearRow) => number) =>
    rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(r.year).toFixed(1)} ${y(Math.max(0, get(r))).toFixed(1)}`).join(" ");

  const last = rows[rows.length - 1];
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => f * ymax);
  const fmtK = (v: number) => `$${Math.round(v / 1000)}k`;
  const lab = (v: number, cls: string, dy: number) => (
    <text x={x(last.year) + 8} y={y(v) + dy} className={"end " + cls}>{fmtK(v)}</text>
  );

  return (
    <figure className="chart animate" role="img" aria-label="Chart of your equity, the government share and your loan balance over 40 years">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="gEq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b6b56" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0b6b56" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r + 10} y1={y(v)} y2={y(v)} className="grid" />
            <text x={P.l - 6} y={y(v) + 4} textAnchor="end" className="axis">{fmtK(v)}</text>
          </g>
        ))}
        {[0, 10, 20, 30, 40].filter((t) => t <= n).map((t) => (
          <text key={t} x={x(Math.min(t, n))} y={H - 8} textAnchor="middle" className="axis">yr {t}</text>
        ))}
        {/* pathLength normalized to 1 → CSS draw-in animation works for any length */}
        <path d={`${path((r) => r.buyerEquityDollar)} L ${x(last.year)} ${y(0)} L ${x(0)} ${y(0)} Z`} className="area" />
        <path d={path((r) => r.cspValue)} className="ln csp" pathLength={1} />
        <path d={path((r) => r.loanBalance)} className="ln loan" pathLength={1} />
        <path d={path((r) => r.buyerEquityDollar)} className="ln equity" pathLength={1} />
        {lab(last.buyerEquityDollar, "e-eq", 4)}
        {lab(last.cspValue, "e-gov", -8)}
        {lab(last.loanBalance, "e-loan", 14)}
      </svg>
      <figcaption className="legend">
        <span className="key equity" /> Your stake in the value
        <span className="key loan" /> Loan balance
        <span className="key csp" /> Commonwealth share ($)
      </figcaption>
    </figure>
  );
}

export type WfKind = "total" | "costs" | "loan" | "gov" | "net";

/** Waterfall rows for the sale scenario - pure divs, colour-coded bars. */
export function Waterfall(props: {
  items: Array<{ label: string; amount: number; kind: WfKind }>;
  base: number;
}) {
  const clsFor: Record<WfKind, string> = {
    total: "total",
    costs: "minus costs",
    loan: "minus loan",
    gov: "minus gov",
    net: "net",
  };
  return (
    <div className="wf" role="table" aria-label="Sale proceeds breakdown">
      {props.items.map((it, i) => (
        <div key={i} className={"wf-row " + clsFor[it.kind]} role="row">
          <span className="wf-label" role="cell">{it.label}</span>
          <span className="wf-bar-track" role="cell">
            <span
              className="wf-bar"
              style={{ width: `${Math.max(1, Math.min(100, (Math.abs(it.amount) / Math.max(1, props.base)) * 100))}%` }}
            />
          </span>
          <span className="wf-amount num" role="cell">
            {it.kind === "costs" || it.kind === "loan" || it.kind === "gov" ? "−" : ""}${Math.abs(Math.round(it.amount)).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
