import { aud, num, pct } from "../lib/format";
import { DUTY_ESTIMATE_NOTE } from "../lib/duty";
import { SRO_LINKS, SOURCES } from "../lib/constants";
import type { Check, Inputs, Projection, Structure } from "../lib/engine";
import { Section } from "./ui";
import { EquityChart, Waterfall } from "./Charts";

export type LoanSnapshot = {
  freq: "weekly" | "fortnightly" | "monthly";
  amounts: Record<string, number>;
  payYears: number;
  totalInterest: number;
  stressedAmount: number;
};

export function Results(props: {
  inputs: Inputs;
  structure: Structure;
  projection: Projection;
  loan: LoanSnapshot;
  checks: Check[];
  dutyEstimate: number | null;
  upfront: number;
  capacity: { estimate: number; against: number };
  setSellYear: (y: number) => void;
  setFreq: (f: "weekly" | "fortnightly" | "monthly") => void;
}) {
  const { inputs: I, structure: s, projection: pr, loan: L, checks, dutyEstimate, upfront, capacity } = props;
  const stateLink = SRO_LINKS[I.state];
  const sellRows = [5, 10, 15, 20, 30];

  return (
    <div className="results">
      <Section
        title="Repayments — your share only"
        id="repay"
        aside={
          <button
            className={"btn seg-mini " + (I.freq === "monthly" ? "on" : "")}
            onClick={() => props.setFreq(nextFreq(I.freq))}
            title="cycle weekly / fortnightly / monthly"
          >
            {I.freq}
          </button>
        }
      >
        <div className="bigno">
          <span className="bigno-amt num">{aud(L.amounts[I.freq], { exact: true })}</span>
          <span className="bigno-unit">per {I.freq === "monthly" ? "month" : I.freq === "fortnightly" ? "fortnight" : "week"}</span>
        </div>
        <table className="flat">
          <thead>
            <tr><th></th><th>each payment</th><th>loan-free in</th><th>interest overall</th></tr>
          </thead>
          <tbody>
            <tr><th>Planned</th><td className="num">{aud(L.amounts[I.freq], { exact: true })}</td><td className="num">{num(L.payYears, 1)} yrs</td><td className="num">{aud(L.totalInterest)}</td></tr>
            <tr>
              <th>Stressed +3% (APRA buffer)</th>
              <td className="num">{aud(L.stressedAmount, { exact: true })}</td>
              <td colSpan={2} className="muted">the buffer the bank applies when assessing you</td>
            </tr>
            <tr><th>Beneficial note</th><td colSpan={3} className="muted">You repay interest on <strong>your share only</strong> — there is no rent or interest on the Commonwealth's {$fmt(s.govShare)} share.</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Checked against the rules" id="checks" aside={<a className="btn" href={SOURCES.eligibilityTool}>official eligibility tool ↗</a>}>
        <ul className="checks">
          {checks.map((c) => (
            <li key={c.id} data-ok={c.ok}>
              <span className="ck" aria-hidden="true">{c.ok === "yes" ? "✓" : c.ok === "no" ? "✕" : "·"}</span>
              <span>
                <strong>{c.label}</strong>
                <span className="ck-detail">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        {s.shortfall > 0 ? (
          <p className="big-warn">
            The gap can't be bridged: with 2% min deposit rules aside, the government contributes at most
            {" "}{aud(s.govShareLimit)} here — you're short {aud(s.shortfall)}. Consider a cheaper property ({aud(s.maxAffordablePrice)}
            {" "}is your official max at this deposit + loan).
          </p>
        ) : null}
      </Section>

      <Section title="Your stake over time" id="equity" aside={<span className="as-on">growth {pct(I.growthPct / 100, 2)} p.a. assumption</span>}>
        <EquityChart rows={pr.rows} />
        <table className="flat">
          <thead>
            <tr><th>Year</th><th>Home value</th><th>Government share ($)</th><th>Your loan</th><th>Your equity</th></tr>
          </thead>
          <tbody>
            {pr.rows.filter((r) => r.year % 5 === 0 || r.year === pr.soldAt?.year).slice(0, 13).map((r) => (
              <tr key={r.year}>
                <th>{r.year}</th>
                <td className="num">{aud(r.homeValue)}</td>
                <td className="num">{aud(r.cspValue)} <span className="muted">({pct(r.cspPct)})</span></td>
                <td className="num">{aud(r.loanBalance)}</td>
                <td className="num strong">{aud(r.buyerEquityDollar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pr.events.length ? (
          <details className="events">
            <summary>{pr.events.length} simulated repayment / adjustment events</summary>
            <ul className="plain">{pr.events.map((e, i) => <li key={i}>{e}</li>)}</ul>
            <p className="muted">
              Buy-backs are ≥ 5% of the current value, rounded to the nearest $1,000, and require a (paid) valuation
              each time. Income-cap reviews happen at least every 5 years — two FYs over cap can trigger a
              required (affordability-gated) repayment.
            </p>
          </details>
        ) : null}
      </Section>

      <Section
        title={I.sellAfterYear > 0 ? `If you sold after year ${I.sellAfterYear}` : "Selling — the payout order"}
        id="sell"
        aside={
          <span className="range-inline">
            <input
              type="range"
              min={0}
              max={40}
              value={I.sellAfterYear}
              aria-label="Sale year"
              onChange={(e) => props.setSellYear(Number(e.target.value))}
            />
            <span>{I.sellAfterYear === 0 ? "slide to model a sale" : `year ${I.sellAfterYear}`}</span>
          </span>
        }
      >
        {pr.soldAt ? (
          <>
            <Waterfall
              base={pr.soldAt.salePrice}
              items={[
                { label: `Sale price (yr ${pr.soldAt.year})`, amount: pr.soldAt.salePrice, kind: "total" },
                { label: "Selling costs (agent % + legal)", amount: pr.soldAt.costs, kind: "minus" },
                { label: "Your home loan payout", amount: pr.soldAt.loanPayout, kind: "minus" },
                { label: `Commonwealth share (${pct(pr.rows[pr.soldAt.year].cspPct)})`, amount: pr.soldAt.govPayout, kind: "minus" },
                { label: "Cash to you", amount: pr.soldAt.yourNet, kind: "net" },
              ]}
            />
            <p className="muted">
              The government receives its share of the <strong>greater of sale price or current valuation</strong>. Eligible
              beneficiaries can take over the arrangement within 2 years — see the Customer Guide.
            </p>
            <table className="flat">
              <caption className="sr-only">Sale net at several horizons</caption>
              <thead><tr><th>Sell after…</th><th>Sale price</th><th>Commonwealth payout</th><th>Loan payout</th><th>Cash to you</th></tr></thead>
              <tbody>
                {sellRows.map((yr) => {
                  const row = pr.rows[yr];
                  const costs = row.homeValue * (I.agentPct / 100) + I.saleLegalFees;
                  const net = row.homeValue - costs - row.loanBalance - row.cspValue;
                  return (
                    <tr key={yr}>
                      <th>yr {yr}</th>
                      <td className="num">{aud(row.homeValue)}</td>
                      <td className="num">{aud(row.cspValue)}</td>
                      <td className="num">{aud(row.loanBalance)}</td>
                      <td className="num strong">{aud(net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : (
          <p className="muted">Slide “model a sale after year” to see the proceeds waterfall and horizons table.</p>
        )}
      </Section>

      <Section title="Cash at settlement & ongoing" id="cash">
        <table className="flat">
          <tbody>
            <tr><th>Deposit</th><td className="num">{aud(s.deposit)}</td></tr>
            <tr>
              <th>Transfer duty</th>
              <td className="num">
                {I.dutyManual !== null
                  ? aud(I.dutyManual) + " (manual)"
                  : dutyEstimate === null
                    ? "no estimate for this territory — enter manually"
                    : aud(dutyEstimate) + " (estimate)"}
                {" "}
                <a href={stateLink} className="mini-link">verify on the SRO calculator ↗</a>
              </td>
            </tr>
            <tr><th>Other upfront costs</th><td className="num">{aud(I.otherUpfrontCosts)}</td></tr>
            <tr><th>Total cash needed</th><td className="num strong">{aud(upfront)}</td></tr>
            <tr><th>Ongoing / month (you carry all of it)</th><td className="num">{aud(I.ongoingMonthlyCosts)} + repayment</td></tr>
          </tbody>
        </table>
        <p className="muted">{DUTY_ESTIMATE_NOTE} Grants and duty concessions can combine with Help to Buy — check your state's first home buyer concessions too.</p>
      </Section>

      <Section title="Serviceability sanity check (rough)" id="capacity">
        <table className="flat">
          <tbody>
            <tr><th>Income inputs → rough borrowing capacity</th><td className="num strong">{aud(capacity.estimate)}</td></tr>
            <tr><th>Your entered borrowing amount</th><td className="num">{aud(capacity.against)}</td></tr>
          </tbody>
        </table>
        <p className="muted">
          Heuristic only (surplus after living costs + HECS + other debts at rate +3% buffer). CBA's formal assessment
          via a Home Lending Specialist governs. If capacity is well below your entered loan, right-size the price.
        </p>
      </Section>
    </div>
  );
}

function nextFreq(f: "weekly" | "fortnightly" | "monthly") {
  return f === "weekly" ? "fortnightly" : f === "fortnightly" ? "monthly" : "weekly";
}

function $fmt(v: number) {
  return `$${Math.round(v).toLocaleString()}`;
}
