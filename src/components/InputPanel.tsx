import type { Inputs } from "../lib/engine";
import { SX, type StateCode } from "../lib/constants";
import { aud, num } from "../lib/format";
import { MoneyInput, PctInput, Row, NumberInput, Seg, SelectRaw, SliderRow } from "./ui";

export default function InputPanel(props: {
  inputs: Inputs;
  set: <K extends keyof Inputs>(k: K, v: Inputs[K]) => void;
  maxAffordable: number;
}) {
  const { inputs: I, set } = props;

  return (
    <div className="panel">
      <details open className="grp">
        <summary><span className="idx">01</span>Your situation</summary>
        <Row label="Applying as">
          <Seg
            name="app-type"
            label="Applying as"
            value={I.applicantType}
            onChange={(v) => set("applicantType", v)}
            options={[
              { value: "single", label: "Single" },
              { value: "singleParent", label: "Single parent" },
              { value: "joint", label: "Joint" },
            ]}
          />
        </Row>
        <Row
          label="Annual taxable income"
          note={I.applicantType === "single" ? "single cap $103,000 · FY 2026-27" : "single parent / joint cap $165,000"}
        >
          <MoneyInput id="income" value={I.combinedIncome} onChange={(v) => set("combinedIncome", v)} step={5000} />
        </Row>
      </details>

      <details open className="grp">
        <summary><span className="idx">02</span>The property</summary>
        <Row label="Home type" note="new = 40% max government share">
          <Seg
            name="home-type"
            label="Home type"
            value={I.homeType}
            onChange={(v) => set("homeType", v)}
            options={[
              { value: "existing", label: "Existing" },
              { value: "new", label: "New / off-plan" },
            ]}
          />
        </Row>
        <Row label="State or territory">
          <SelectRaw
            id="state"
            value={I.state}
            onChange={(v) => set("state", v as StateCode)}
            options={(Object.keys(SX) as StateCode[]).map((s) => ({
              value: s,
              label: s === "JBT" ? SX.JBT : s === "CXCK" ? SX.CXCK : s,
            }))}
          />
        </Row>
        <Row label="Location class" note="regional centres: Geelong, Gold Coast, Sunshine Coast, Newcastle…">
          <Seg
            name="region"
            label="Location class"
            value={I.region}
            onChange={(v) => set("region", v)}
            options={[
              { value: "major", label: "Capital / regional centre" },
              { value: "rest", label: "Rest of state" },
            ]}
          />
        </Row>
        <Row label="Purchase price">
          <MoneyInput id="value" value={I.homeValue} onChange={(v) => set("homeValue", v)} step={10_000} wide />
        </Row>
        <Row label="Initial valuation (optional)" note="if the valuer values it below the price, the share % rises off that figure">
          <Seg
            name="val"
            label="Initial valuation"
            value={I.valuation0 === null ? "off" : "on"}
            onChange={(v) => set("valuation0", v === "on" ? I.homeValue : null)}
            options={[
              { value: "off", label: "Same as price" },
              { value: "on", label: "Enter lower" },
            ]}
          />
        </Row>
        {I.valuation0 !== null ? (
          <Row label="Valued at" note="clause 6.3: the share is measured on min(price, valuation)">
            <MoneyInput value={I.valuation0} onChange={(v) => set("valuation0", v)} step={5000} wide />
          </Row>
        ) : null}
        <Row label="Your deposit" note="keep about $5-6k more aside for duty and setup costs">
          <MoneyInput id="deposit" value={I.deposit} onChange={(v) => set("deposit", v)} step={1000} wide />
        </Row>
        <Row label="Most the bank will lend you" note="unsure? Use plan 06 below as a rough check">
          <MoneyInput id="loan" value={I.maxLoan} onChange={(v) => set("maxLoan", v)} step={5000} wide />
        </Row>
        <Row label="Government contribution" note="covers what's left, up to 30% existing or 40% new">
          <Seg
            name="gov-mode"
            label="Contribution mode"
            value={I.govShareMode}
            onChange={(v) => set("govShareMode", v)}
            options={[
              { value: "gap", label: "Bridge the gap" },
              { value: "custom", label: "Set % share" },
            ]}
          />
        </Row>
        {I.govShareMode === "custom" ? (
          <SliderRow
            label="Government share"
            value={I.customGovSharePct}
            min={0}
            max={I.homeType === "new" ? 40 : 30}
            step={0.5}
            display={`${num(I.customGovSharePct, 1)}% · ${aud(I.homeValue * I.customGovSharePct / 100)}`}
            onChange={(v) => set("customGovSharePct", v)}
          />
        ) : (
          <p className="hist">
            Covers price − deposit − loan. Official max price at your capacity: <strong>{aud(props.maxAffordable)}</strong>.
          </p>
        )}
      </details>

      <details open className="grp">
        <summary><span className="idx">03</span>The loan</summary>
        <Row label="Loan term" note="principal and interest, up to 30 years">
          <Seg
            name="term"
            label="Loan term"
            value={String(I.termYears)}
            onChange={(v) => set("termYears", Number(v))}
            options={[
              { value: "20", label: "20y" },
              { value: "25", label: "25y" },
              { value: "30", label: "30y" },
            ]}
          />
        </Row>
        <Row label="Interest rate" note="typical standard variable; not a quote">
          <PctInput id="rate" value={I.ratePct} onChange={(v) => set("ratePct", v)} min={0} max={12} step={0.05} />
        </Row>
        <Row label="Repayment frequency">
          <Seg
            name="freq"
            label="Repayment frequency"
            value={I.freq}
            onChange={(v) => set("freq", v)}
            options={[
              { value: "weekly", label: "Weekly" },
              { value: "fortnightly", label: "Fortnightly" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
        </Row>
        <Row label="Extra repayment" note="per payment, on your share only">
          <MoneyInput value={I.extraRepayment} onChange={(v) => set("extraRepayment", v)} step={50} />
        </Row>
      </details>

      <details className="grp">
        <summary><span className="idx">04</span>Plans: buy-backs &amp; improvements</summary>
        <Row label="Property growth per year">
          <PctInput value={I.growthPct} onChange={(v) => set("growthPct", v)} min={-10} max={15} step={0.25} />
        </Row>
        <Row label="Buy-back plan">
          <Seg
            name="bb"
            label="Buy-back plan"
            value={I.buyback.enabled ? "on" : "off"}
            onChange={(v) => set("buyback", { ...I.buyback, enabled: v === "on" })}
            options={[
              { value: "off", label: "None" },
              { value: "on", label: "Planned" },
            ]}
          />
        </Row>
        {I.buyback.enabled ? (
          <>
            <Row label="First buy-back in year">
              <NumberInput value={I.buyback.startYear} onChange={(v) => set("buyback", { ...I.buyback, startYear: Math.max(1, v) })} min={1} />
            </Row>
            <Row label="Buy back per year" note="≥ 5% of value is the scheme minimum">
              <PctInput
                value={I.buyback.percentPerYear}
                onChange={(v) => set("buyback", { ...I.buyback, percentPerYear: v })}
                min={0}
                max={30}
                step={0.5}
              />
            </Row>
            <Row label="Funded by">
              <Seg
                name="bbf"
                label="Funded by"
                value={I.buyback.fundByLoan ? "loan" : "savings"}
                onChange={(v) => set("buyback", { ...I.buyback, fundByLoan: v === "loan" })}
                options={[
                  { value: "savings", label: "Savings" },
                  { value: "loan", label: "Loan increase" },
                ]}
              />
            </Row>
          </>
        ) : null}
        <Row label="Improvement (optional)" note="over $21k must be notified; the share adjusts so you keep the gain">
          <Seg
            name="imp"
            label="Improvement"
            value={I.improvement ? "on" : "off"}
            onChange={(v) =>
              set("improvement", v === "on" ? { year: 5, cost: 40_000, valueUplift: 40_000 } : null)
            }
            options={[
              { value: "off", label: "None" },
              { value: "on", label: "Model one" },
            ]}
          />
        </Row>
        {I.improvement ? (
          <>
            <Row label="Improvement year">
              <NumberInput
                value={I.improvement.year}
                onChange={(v) => set("improvement", { ...I.improvement!, year: Math.max(1, v) })}
                min={1}
              />
            </Row>
            <Row label="Cost">
              <MoneyInput
                value={I.improvement.cost}
                onChange={(v) => set("improvement", { ...I.improvement!, cost: v })}
                step={1000}
              />
            </Row>
            <Row label="Value it adds" note="your estimate; a valuation happens in practice">
              <MoneyInput
                value={I.improvement.valueUplift}
                onChange={(v) => set("improvement", { ...I.improvement!, valueUplift: v })}
                step={1000}
              />
            </Row>
          </>
        ) : null}
        <p className="hist">
          Note: improvement costs add up over a 12-month window towards the $21,000 threshold, you must notify before
          you start, and the adjustment applies only if you did notify. Improvements come out of your pocket (savings
          or borrowing); the government does not fund them.
        </p>
        <Row label="Income above the cap from year" note="0 = never. Models the required minimum payment">
          <NumberInput value={I.incAboveCapFromYear} onChange={(v) => set("incAboveCapFromYear", Math.max(0, v))} min={0} max={40} />
        </Row>
        <Row label="Income growth / year" note="for the review projection">
          <PctInput value={I.incomeGrowthPct} onChange={(v) => set("incomeGrowthPct", v)} min={0} max={12} step={0.5} />
        </Row>
      </details>

      <details className="grp">
        <summary><span className="idx">05</span>Selling &amp; one-off costs</summary>
        <SliderRow
          label="Model a sale after year"
          value={I.sellAfterYear}
          min={0}
          max={40}
          display={I.sellAfterYear === 0 ? "not modeled" : `year ${I.sellAfterYear}`}
          onChange={(v) => set("sellAfterYear", v)}
        />
        <Row label="Selling agent fee">
          <PctInput value={I.agentPct} onChange={(v) => set("agentPct", v)} min={0} max={6} step={0.25} />
        </Row>
        <Row label="Sale legal fees">
          <MoneyInput value={I.saleLegalFees} onChange={(v) => set("saleLegalFees", v)} step={250} />
        </Row>
        <Row label="Other upfront costs" note="conveyancing, inspections, registration, valuations">
          <MoneyInput value={I.otherUpfrontCosts} onChange={(v) => set("otherUpfrontCosts", v)} step={250} />
        </Row>
        <Row label="Transfer duty" note="rough estimate in the results; type the exact figure when you have it">
          <Seg
            name="duty"
            label="Transfer duty"
            value={I.dutyManual === null ? "auto" : "manual"}
            onChange={(v) => set("dutyManual", v === "auto" ? null : 0)}
            options={[
              { value: "auto", label: "Estimate" },
              { value: "manual", label: "Manual" },
            ]}
          />
        </Row>
        {I.dutyManual !== null ? (
          <Row label="Duty amount">
            <MoneyInput value={I.dutyManual} onChange={(v) => set("dutyManual", v)} step={500} />
          </Row>
        ) : null}
        <Row label="Ongoing costs / month" note="rates, insurance, strata: all paid by you">
          <MoneyInput value={I.ongoingMonthlyCosts} onChange={(v) => set("ongoingMonthlyCosts", v)} step={50} />
        </Row>
      </details>

      <details className="grp">
        <summary><span className="idx">06</span>Serviceability inputs</summary>
        <Row label="HECS/HELP haircut" note="share of gross income you expect to lose to repayment">
          <PctInput value={I.hecsPct} onChange={(v) => set("hecsPct", v)} min={0} max={20} step={0.5} />
        </Row>
        <Row label="Other debt repayments / month">
          <MoneyInput value={I.otherMonthlyDebt} onChange={(v) => set("otherMonthlyDebt", v)} step={50} />
        </Row>
        <Row label="Living expenses / month">
          <MoneyInput value={I.livingMonthly} onChange={(v) => set("livingMonthly", v)} step={100} />
        </Row>
      </details>
    </div>
  );
}
