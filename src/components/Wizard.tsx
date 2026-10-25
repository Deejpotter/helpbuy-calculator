import { useState } from "react";
import { SX, RBA_NOTE, type StateCode } from "../lib/constants";
import { borrowingCapacity, type Inputs } from "../lib/engine";
import { aud } from "../lib/format";
import { MoneyInput, PctInput, Row, Seg, SelectRaw } from "./ui";

/**
 * First-run guided setup: three short steps that fill the calculator in.
 * Sequential and independent steps (per NN/g staged disclosure), everything applies live.
 */
export default function Wizard(props: {
  set: (patch: Partial<Inputs>) => void;
  inputs: Inputs;
  done: () => void;
  useDefaults: () => void;
}) {
  const [step, setStep] = useState(1);
  const { inputs: I, set } = props;

  const estimated = borrowingCapacity({
    grossIncome: I.combinedIncome,
    livingMonthly: I.livingMonthly,
    otherMonthlyDebt: I.otherMonthlyDebt,
    hecsPct: I.hecsPct,
    ratePct: I.ratePct,
    termYears: I.termYears,
  });

  const cap =
    I.applicantType === "single" ? 103_000 : 165_000;

  return (
    <div className="wizard" role="dialog" aria-modal="true" aria-label="Guided setup">
      <div className="wizard-col wizard-enter">
        <p className="wizard-progress">Step {step} of 3</p>

        {step === 1 ? (
          <>
            <h2>Who is buying?</h2>
            <Row label="Applying as">
              <Seg
                name="w-app"
                label="Applying as"
                value={I.applicantType}
                onChange={(v) => set({ applicantType: v })}
                options={[
                  { value: "single", label: "Single" },
                  { value: "singleParent", label: "Single parent" },
                  { value: "joint", label: "Two applicants" },
                ]}
              />
            </Row>
            <Row label="Combined taxable income per year">
              <MoneyInput id="w-income" value={I.combinedIncome} onChange={(v) => set({ combinedIncome: v })} step={5000} wide />
            </Row>
            <p className="hist">
              This is the number from your most recent tax Notice of Assessment, not your payslip.
              The scheme's income cap is {aud(cap)} for this application type; if you are under it,
              you clear the income test. Caps rise with wages every 1 July.
            </p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2>What kind of home?</h2>
            <Row label="Where">
              <SelectRaw
                id="w-state"
                value={I.state}
                onChange={(v) => set({ state: v as StateCode })}
                options={(Object.keys(SX) as StateCode[]).map((s) => ({ value: s, label: s }))}
              />
            </Row>
            <Row label="Location class" note="not sure? leave this - you can check by postcode below">
              <Seg
                name="w-region"
                label="Location class"
                value={I.region}
                onChange={(v) => set({ region: v })}
                options={[
                  { value: "major", label: "Capital city / regional centre" },
                  { value: "rest", label: "Rest of state" },
                ]}
              />
            </Row>
            <Row label="Home type" note="new or off-plan homes get a bigger share">
              <Seg
                name="w-type"
                label="Home type"
                value={I.homeType}
                onChange={(v) => set({ homeType: v })}
                options={[
                  { value: "existing", label: "Existing" },
                  { value: "new", label: "New / off-plan" },
                ]}
              />
            </Row>
            <Row label="Price range" note="under the location's price cap">
              <MoneyInput id="w-value" value={I.homeValue} onChange={(v) => set({ homeValue: v })} step={10_000} wide />
            </Row>
            <p className="hist">Enter a rough price; the planner checks the cap for you.</p>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2>The loan</h2>
            <Row label="Most the bank will lend you" note={`estimated: ${aud(estimated)}`}>
              <MoneyInput id="w-loan" value={I.maxLoan} onChange={(v) => set({ maxLoan: v })} step={5000} wide />
            </Row>
            <Row label="Interest rate">
              <PctInput id="w-rate" value={I.ratePct} onChange={(v) => set({ ratePct: v })} min={0} max={12} step={0.05} />
            </Row>
            <Row label="Loan term" note="principal and interest, up to 30 years">
              <Seg
                name="w-term"
                label="Loan term"
                value={String(I.termYears)}
                onChange={(v) => set({ termYears: Number(v) })}
                options={[
                  { value: "20", label: "20y" },
                  { value: "25", label: "25y" },
                  { value: "30", label: "30y" },
                ]}
              />
            </Row>
            <p className="hist">{RBA_NOTE}</p>
          </>
        ) : null}

        <div className="wizard-actions">
          <div>{step > 1 ? <button className="btn" onClick={() => setStep(step - 1)}>Back</button> : null}</div>
          <div className="wizard-next">
            {step === 1 ? <button className="btn" onClick={props.useDefaults}>Use the defaults</button> : null}
            {step < 3 ? (
              <button className="btn solid" onClick={() => setStep(step + 1)}>Continue</button>
            ) : (
              <button className="btn solid" onClick={props.done}>See my plan</button>
            )}
          </div>
        </div>
        <button className="mini-cta" onClick={props.done}>Skip setup - keep the numbers already loaded</button>
      </div>
    </div>
  );
}
