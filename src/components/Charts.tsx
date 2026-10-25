import type { YearRow } from "../lib/engine";
import { moneyShort } from "../lib/format";

type EndLabel = { value: number; cls: string; name: string; y: number; dy: number };

/** Hand-rolled SVG equity timeline: buyer equity (area) · loan balance · Commonwealth share. */
export function EquityChart(props: { rows: YearRow[] }) {
  const { rows } = props;
  const H = 240;
  const W = 680;
  const P = { l: 64, r: 96, t: 18, b: 26 };
  const n = Math.max(1, rows.length - 1);
  const last = rows[rows.length - 1];
  const ymax =
    Math.max(
      1,
      ...rows.map((r) => Math.max(r.homeValue, r.cspValue, r.loanBalance, r.buyerEquityDollar)),
    ) || 1;

  const y = (v: number) => P.t + (1 - v / ymax) * (H - P.t - P.b);
  const x = (t: number) => P.l + (t / n) * (W - P.l - P.r);
  const path = (get: (r: YearRow) => number) =>
    rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(r.year).toFixed(1)} ${y(Math.max(0, get(r))).toFixed(1)}`).join(" ");

  // dynamic ticks so the axis always spans the real horizon
  const tickStep = n > 60 ? 20 : n > 30 ? 10 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= n; t += tickStep) ticks.push(t);
  if (ticks[ticks.length - 1] !== n) ticks.push(n);

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => f * ymax);

  // end labels: named, and nudged apart so converging lines stay readable
  const labels: EndLabel[] = [
    { value: last.buyerEquityDollar, cls: "e-eq", name: "You", y: y(last.buyerEquityDollar), dy: 0 },
    { value: last.loanBalance, cls: "e-loan", name: "Loan", y: y(last.loanBalance), dy: 0 },
    { value: last.cspValue, cls: "e-gov", name: "Gov", y: y(last.cspValue), dy: 0 },
  ];
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y - labels[i - 1].y < 13) labels[i].y = labels[i - 1].y + 13;
  }

  return (
    <figure className="chart animate" role="img" aria-label={`Line chart over ${n} years: your equity, the loan balance and the government share`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="gEq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b6b56" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0b6b56" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r + 12} y1={y(v)} y2={y(v)} className="grid" />
            <text x={P.l - 6} y={y(v) + 4} textAnchor="end" className="axis">{moneyShort(v)}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(Math.min(t, n))} y={H - 8} textAnchor="middle" className="axis">yr {t}</text>
        ))}
        {/* pathLength normalized to 1 -> CSS draw-in animation works for any length */}
        <path d={`${path((r) => r.buyerEquityDollar)} L ${x(last.year)} ${y(0)} L ${x(0)} ${y(0)} Z`} className="area" />
        <path d={path((r) => r.cspValue)} className="ln csp" pathLength={1} />
        <path d={path((r) => r.loanBalance)} className="ln loan" pathLength={1} />
        <path d={path((r) => r.buyerEquityDollar)} className="ln equity" pathLength={1} />
        {labels.map((l, i) => (
          <text key={i} x={x(last.year) + 8} y={l.y + 4} className={"end " + l.cls}>
            {l.name} {moneyShort(l.value)}
          </text>
        ))}
      </svg>
      <figcaption className="legend">
        <span className="key equity" /> Your stake in the value
        <span className="key loan" /> Loan balance (every loan)
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
            {it.kind === "costs" || it.kind === "loan" || it.kind === "gov" ? "\u2212" : ""}${Math.abs(Math.round(it.amount)).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
