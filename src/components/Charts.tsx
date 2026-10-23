import type { YearRow } from "../lib/engine";

/** Hand-rolled SVG equity timeline: buyer equity · Commonwealth share · loan balance. */
export function EquityChart(props: { rows: YearRow[] }) {
  const { rows } = props;
  const H = 230;
  const W = 680;
  const P = { l: 64, r: 16, t: 14, b: 26 };
  const n = Math.max(1, rows.length - 1);
  const ymax = Math.max(...rows.map((r) => Math.max(r.homeValue, r.cspValue + r.buyerEquityDollar))) || 1;

  const y = (v: number) => P.t + (1 - v / ymax) * (H - P.t - P.b);
  const x = (t: number) => P.l + (t / n) * (W - P.l - P.r);
  const path = (get: (r: YearRow) => number) =>
    rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(r.year).toFixed(1)} ${y(Math.max(0, get(r))).toFixed(1)}`).join(" ");

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => f * ymax);
  const fmtK = (v: number) => `$${Math.round(v / 1000)}k`;

  return (
    <figure className="chart" role="img" aria-label="Chart of your equity, the government share and your loan balance over 40 years">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={P.l - 6} y={y(v) + 4} textAnchor="end" className="axis">{fmtK(v)}</text>
          </g>
        ))}
        {[0, 10, 20, 30, 40].filter((t) => t <= n).map((t) => (
          <text key={t} x={x(Math.min(t, n))} y={H - 8} textAnchor="middle" className="axis">yr {t}</text>
        ))}
        <path d={path((r) => r.cspValue)} className="ln csp" />
        <path d={path((r) => r.loanBalance)} className="ln loan" />
        <path d={path((r) => r.buyerEquityDollar)} className="ln equity" />
      </svg>
      <figcaption className="legend">
        <span className="key equity" /> Your stake in the value
        <span className="key loan" /> Loan balance
        <span className="key csp" /> Commonwealth share ($)
      </figcaption>
    </figure>
  );
}

/** Waterfall rows for the sale scenario — pure divs, hairline bars. */
export function Waterfall(props: {
  items: Array<{ label: string; amount: number; kind: "total" | "minus" | "net" }>;
  base: number;
}) {
  return (
    <div className="wf" role="table" aria-label="Sale proceeds breakdown">
      {props.items.map((it, i) => (
        <div key={i} className={"wf-row " + it.kind} role="row">
          <span className="wf-label" role="cell">{it.label}</span>
          <span className="wf-bar-track" role="cell">
            <span
              className="wf-bar"
              style={{ width: `${Math.max(1, Math.min(100, (Math.abs(it.amount) / Math.max(1, props.base)) * 100))}%` }}
            />
          </span>
          <span className="wf-amount num" role="cell">
            {it.kind === "minus" ? "−" : ""}${Math.abs(Math.round(it.amount)).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
