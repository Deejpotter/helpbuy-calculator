import { aud, num, pct, roundTo } from "../lib/format";
import { DUTY_ESTIMATE_NOTE } from "../lib/duty";
import { RULES, SRO_LINKS, SOURCES, type StateCode } from "../lib/constants";
import type { Check, Inputs, Projection, Structure } from "../lib/engine";
import { Section, useAnimatedNumber } from "./ui";
import { EquityChart, Waterfall, type WfKind } from "./Charts";

export type LoanSnapshot = {
  freq: "weekly" | "fortnightly" | "monthly";
  amounts: Record<string, number>;
  payYears: number;
  totalInterest: number;
  stressedAmount: number;
};

const CHIP = { yes: "pass", no: "fix", check: "review" } as const;
const CHIP_LABEL = { yes: "Meets", no: "Fix", check: "Review" } as const;
const FREQ_UNIT = { weekly: "week", fortnightly: "fortnight", monthly: "month" } as const;

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
  onEnableBuyback: () => void;
}) {
  const { inputs: I, structure: s, projection: pr, loan: L, checks, dutyEstimate, upfront, capacity } = props;
  const bs = pr.buybackSummary;
  const stateLink = SRO_LINKS[I.state];

  const minBuyback = Math.round((RULES.minBuybackShareOfValue * s.homeValue) / RULES.buybackRoundTo) * RULES.buybackRoundTo;
  const repayShown = useAnimatedNumber(L.amounts[I.freq]);
  const stakeShown = useAnimatedNumber((1 - s.govSharePct) * 100);
  const cspShown = useAnimatedNumber(s.govShare);
  const buyShown = useAnimatedNumber(minBuyback);

  const coverageBase = Math.max(1, s.homeValue);
  const cGov = s.govShare / coverageBase;
  const cLoan = Math.min(s.buyerLoan, s.homeValue) / coverageBase;
  const cCash = s.deposit / coverageBase;

  const sellRows = [5, 10, 15, 20, 30];

  return (
    <div className="results">
      <div className="hero" id="hero">
        <div className="hero-grid">
          <div className="hero-cell t-green">
            <h3><span className="dot" />Repayment</h3>
            <span className="val num">{aud(repayShown, { exact: true })}</span>
            <span className="per">per {FREQ_UNIT[I.freq]}</span>
            <span className="cap">{aud(L.amounts.monthly)} if monthly - {I.buyback.enabled && I.buyback.fundByLoan ? "first loan" : "loan"} paid off in {num(L.payYears, 1)} years</span>
          </div>
          <div className="hero-cell t-green">
            <h3><span className="dot" />Your share</h3>
            <span className="val num">{pct(stakeShown / 100)}</span>
            <span className="cap">{aud(s.buyerShare)} of the value. Loan-to-price {pct(s.lvr)}</span>
          </div>
          <div className="hero-cell t-amber">
            <h3><span className="dot" />Government share</h3>
            <span className="val num">{aud(cspShown)}</span>
            <span className="cap">{pct(s.govSharePct)} of the value. No interest, no rent</span>
          </div>
          <div className="hero-cell t-ink">
            <h3><span className="dot" />Buy back a share from</h3>
            <span className="val num">{aud(buyShown)}</span>
            <span className="cap">the minimum: 5% of today's value</span>
            {!I.buyback.enabled ? (
              <button className="mini-cta" onClick={props.onEnableBuyback}>
                Model a buy-back plan →
              </button>
            ) : (
              <span className="cap c-green">plan on - see Path to full ownership</span>
            )}
          </div>
        </div>

        <div className="own" aria-label="How the purchase price is covered">
          <div className="own-bar">
            <span className="o-eq" style={{ width: `${cCash * 100}%` }} />
            <span className="o-loan" style={{ width: `${cLoan * 100}%` }} />
            <span className="o-gov" style={{ width: `${cGov * 100}%` }} />
          </div>
          <div className="own-caps">
            <span className="k-eq"><i />Your cash<span className="num">{aud(s.deposit)}</span></span>
            <span className="k-loan"><i />Your loan<span className="num">{aud(s.buyerLoan)}</span></span>
            <span className="k-gov"><i />Commonwealth<span className="num">{aud(s.govShare)}</span></span>
          </div>
        </div>
      </div>

      <Section title="Repayment detail" id="repay" index="01" aside={
        <button className={"btn seg-mini " + (I.freq === "monthly" ? "on" : "")} onClick={() => props.setFreq(nextFreq(I.freq))} title="cycle weekly / fortnightly / monthly">
          {I.freq}
        </button>
      }>
        <table className="flat">
          <thead>
            <tr><th></th><th>each payment</th><th>loan-free in</th><th>interest overall</th></tr>
          </thead>
          <tbody>
            <tr className="row-you"><th>Planned</th><td className="num">{aud(L.amounts[I.freq], { exact: true })}</td><td className="num">{num(L.payYears, 1)} yrs</td><td className="num">{aud(L.totalInterest)}</td></tr>
            <tr>
              <th>Stressed +3% (APRA buffer)</th>
              <td className="num c-clay">{aud(L.stressedAmount, { exact: true })}</td>
              <td colSpan={2} className="muted">the buffer the bank applies when assessing you</td>
            </tr>
            <tr>
              <th>Remember</th>
              <td colSpan={3} className="muted" style={{ textAlign: "left" }}>
                You pay interest on your share only. Interest-only repayments are allowed only while a home is being built.
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Checked against the rules" id="checks" index="02" aside={<a className="btn" href={SOURCES.eligibilityTool}>official eligibility tool �-</a>}>
        <ul className="checks">
          {checks.map((c) => (
            <li key={c.id} data-ok={c.ok}>
              <span className="ck" aria-hidden="true">{c.ok === "yes" ? "✓" : c.ok === "no" ? "✕" : "·"}</span>
              <span>
                <span className="ck-line">
                  <strong>{c.label}</strong>
                  <span className={"chip " + CHIP[c.ok]}>{CHIP_LABEL[c.ok]}</span>
                </span>
                <span className="ck-detail">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        {s.shortfall > 0 ? (
          <p className="big-warn">
            The numbers don't close here: the biggest government contribution would be {aud(s.govShareLimit)}, leaving
            you {aud(s.shortfall)} short. At this deposit and loan, the biggest home the scheme could bridge is
            {" "}{aud(s.maxAffordablePrice)}.
          </p>
        ) : null}
      </Section>

      <Section title="Your share over time" id="equity" index="03" aside={<span className="as-on">assuming {pct(I.growthPct / 100, 2)} growth a year (set by you)</span>}>
        <EquityChart rows={pr.rows} />
        <details className="events">
          <summary>Five-year milestones (values, share, loan, your equity)</summary>
          <table className="flat">
            <thead>
              <tr><th>Year</th><th>Home value</th><th>Commonwealth</th><th>Your loan</th><th>Your equity</th></tr>
            </thead>
            <tbody>
              {pr.rows.filter((r) => r.year % 5 === 0 || r.year === pr.soldAt?.year).slice(0, 13).map((r) => (
                <tr key={r.year} className={r.year === 0 ? "row-you" : undefined}>
                  <th>{r.year}</th>
                  <td className="num">{aud(r.homeValue)}</td>
                  <td className="num">{aud(r.cspValue)} <span className="muted">({pct(r.cspPct)})</span></td>
                  <td className="num">{aud(r.loanBalance)}</td>
                  <td className="num strong c-green">{aud(r.buyerEquityDollar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        {pr.events.length ? (
          <details className="events" open={pr.events.length <= 8}>
            <summary>{pr.events.length} buy-backs and adjustments worked through</summary>
            <ul className="plain">{pr.events.map((e, i) => <li key={i}>{e}</li>)}</ul>
            <p className="muted">
              Every buy-back must be at least 5% of the value at the time, rounded to $1,000, with a fresh valuation
              (you pay for it). If your income is over the cap two tax years in a row at a review (at least every 5
              years), a buy-back can become required, but only if you can afford it.
            </p>
          </details>
        ) : null}
      </Section>

      <Section title="Path to full ownership" id="buyback" index="04">
        {bs.payments > 0 ? (
          <>
            <div className="journey">
              <div className="journey-track">
                <div className="journey-fill" style={{ width: `${(1 - s.govSharePct) * 100}%` }} />
              </div>
              <div className="journey-caps">
                <span>today · you own {pct(1 - s.govSharePct)}</span>
                <span>100%{bs.fullOwnershipYear ? `, full ownership by year ${bs.fullOwnershipYear}` : ""}</span>
              </div>
            </div>
            <table className="flat">
              <tbody>
                <tr className="row-you"><th>First buy-back modeled</th><td className="num">yr {bs.firstYear}</td></tr>
                <tr><th>Payments modeled</th><td className="num">{bs.payments}</td></tr>
                <tr><th>Total paid to the Commonwealth</th><td className="num strong c-green">{aud(bs.totalPaid)}</td></tr>
                <tr>
                  <th>Funding</th>
                  <td className="num muted">
                    {I.buyback.fundByLoan
                      ? `a new loan each time - ${aud(bs.borrowed)} borrowed across ${bs.payments === 1 ? "1 loan" : `${bs.payments} loans`}`
                      : "from savings"}
                  </td>
                </tr>
                {I.buyback.fundByLoan && bs.borrowed > 0 ? (
                  <tr>
                    <th>The new loans add</th>
                    <td className="num">{aud(bs.extraRepayment)} per {FREQ_UNIT[I.freq]}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {I.buyback.fundByLoan ? (
              <p className="muted">
                Each buy-back is its own new loan at your rate and term, repaid principal and interest. That keeps the
                balance honest: it falls year by year, and a payment made after the first loan is repaid still shows
                up as debt. It also matters in practice - once that first loan is gone, a buy-back can only be paid
                from savings or a new loan, and the lender has to approve and re-quote the repayment each time. Funding
                this way can bring Lender's Mortgage Insurance back if the bigger loan goes over 80% of the value (the
                scheme's Target Market Determination allows that choice). A fresh valuation is needed for each payment
                and it must be made within 90 days of the valuation date.
              </p>
            ) : null}
            <p className="muted">
              Every payment is at least 5% of the value <em>at that time</em>, rounded to $1,000, and based on a fresh
              valuation you pay for. It's never valued from what the government first contributed. Adjust the schedule
              in Plans: buy-backs &amp; improvements.
            </p>
          </>
        ) : (
          <div className="cta-box">
            <p>
              You can buy the government out <strong>any time, in one go or bit by bit</strong>. Each payment must be
              at least 5% of the home's value at that point - about <strong>{aud(minBuyback)}</strong> today. Pay it
              from savings, by a new loan, or both. If your income sits over the cap two tax years in a row, a
              buy-back can become required, but only if you can afford it.
            </p>
            <button className="btn solid" onClick={props.onEnableBuyback}>Model a minimal buy-back plan</button>
          </div>
        )}
      </Section>

      <Section
        title={I.sellAfterYear > 0 ? `If you sold after year ${I.sellAfterYear}` : "Selling - the payout order"}
        id="sell"
        index="05"
        aside={
          <span className="range-inline">
            <input type="range" min={0} max={40} value={I.sellAfterYear} aria-label="Sale year"
              onChange={(e) => props.setSellYear(Number(e.target.value))} />
            <span>{I.sellAfterYear === 0 ? "slide to model a sale" : `year ${I.sellAfterYear}`}</span>
          </span>
        }
      >
        {pr.soldAt ? (
          <>
            <Waterfall
              base={pr.soldAt.salePrice}
              items={[
                { label: `Sale price (yr ${pr.soldAt.year})`, amount: pr.soldAt.salePrice, kind: "total" as WfKind },
                { label: "Selling costs (agent % + legal)", amount: pr.soldAt.costs, kind: "costs" as WfKind },
                { label: "Your home loan payout", amount: pr.soldAt.loanPayout, kind: "loan" as WfKind },
                { label: `Commonwealth (${pct(pr.rows[pr.soldAt.year].cspPct)})`, amount: pr.soldAt.govPayout, kind: "gov" as WfKind },
                { label: "Cash to you", amount: pr.soldAt.yourNet, kind: "net" as WfKind },
              ]}
            />
            <p className="muted">
              At sale the government takes its share of the sale price (or the valuation if that's higher). An eligible
              beneficiary can take over the arrangement within two years - see the Customer Guide.
            </p>
            <table className="flat">
              <thead><tr><th>Sell after…</th><th>Sale price</th><th>Commonwealth</th><th>Loan payout</th><th>Cash to you</th></tr></thead>
              <tbody>
                {sellRows.map((yr) => {
                  const row = pr.rows[yr];
                  const costs = row.homeValue * (I.agentPct / 100) + I.saleLegalFees;
                  const net = row.homeValue - costs - row.loanBalance - row.cspValue;
                  return (
                    <tr key={yr} className={yr === I.sellAfterYear ? "row-you" : undefined}>
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
          <p className="muted">Drag the slider above to model a sale and see who gets paid what.</p>
        )}
      </Section>

      <Section title="Cash at settlement & ongoing" id="cash" index="06">
        <table className="flat">
          <tbody>
            <tr className="row-you"><th>Deposit</th><td className="num strong c-green">{aud(s.deposit)}</td></tr>
            <tr>
              <th>Transfer duty</th>
              <td className="num">
                {I.dutyManual !== null
                  ? aud(I.dutyManual) + " (manual)"
                  : dutyEstimate === null
                    ? "no estimate for this territory - enter the amount yourself"
                    : aud(dutyEstimate) + " (estimate)"}
                {" "}
                <a href={stateLink} className="mini-link">check it on your state's calculator �-</a>
              </td>
            </tr>
            <tr><th>Other upfront costs</th><td className="num">{aud(I.otherUpfrontCosts)}</td></tr>
            <tr><th>Total cash needed</th><td className="num strong">{aud(upfront)}</td></tr>
            <tr><th>Ongoing / month (all yours to carry)</th><td className="num">{aud(I.ongoingMonthlyCosts)} + repayment</td></tr>
          </tbody>
        </table>
        <p className="muted">{DUTY_ESTIMATE_NOTE} Grants and duty concessions can stack with Help to Buy, so check your state's first home buyer concessions too.</p>
      </Section>

      <Section title="Serviceability sanity check (rough)" id="capacity" index="07">
        <table className="flat">
          <tbody>
            <tr className="row-you"><th>Income inputs → rough capacity</th><td className="num strong c-green">{aud(capacity.estimate)}</td></tr>
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
