import { aud, pct } from "../lib/format";
import type { Inputs, Structure } from "../lib/engine";
import type { LoanSnapshot } from "./Results";
import { Section } from "./ui";

export type Slot = { label: string; inputs: Inputs | null };

export const summarize = (
  inputs: Inputs,
  structure: Structure,
  loan: LoanSnapshot,
): { repay: string; payYears: number; totalInterest: number; govPct: number; lvr: number; price: number; cap: number | null; capOk: boolean; saleNet: number | null; deposit: number; govShare: number; buyerLoan: number } => ({
  repay: aud(loan.amounts[inputs.freq], { exact: true }),
  payYears: loan.payYears,
  totalInterest: loan.totalInterest,
  govPct: structure.govSharePct,
  lvr: structure.lvr,
  price: structure.homeValue,
  cap: structure.scans.cap,
  capOk: structure.scans.capOk,
  saleNet: null,
  deposit: structure.deposit,
  govShare: structure.govShare,
  buyerLoan: structure.buyerLoan,
});

export default function Compare(props: {
  slots: Slot[];
  compute: (inputs: Inputs) => { s: Structure; loan: LoanSnapshot; summary: ReturnType<typeof summarize> };
  expandToInputs: (which: Inputs | null) => void;
  collapseToSlot: (i: number) => void;
  expandSlot: (i: number) => void;
}) {
  const { slots, compute } = props;
  const filled = slots
    .map((sl, i) => ({ sl, i, data: sl.inputs ? compute(sl.inputs) : null }))
    .filter((x) => x.data != null) as Array<{ sl: Slot; i: number; data: { s: Structure; loan: LoanSnapshot; summary: ReturnType<typeof summarize> } }>;

  return (
    <Section title="Compare scenarios" id="compare" aside={<span className="muted">A / B / C slots live in this browser</span>}>
      <div className="slot-btns">
        {slots.map((sl, i) => (
          <button key={i} className="btn" onClick={() => props.collapseToSlot(i)} disabled={sl.inputs === null}>
            Save current → {String.fromCharCode(65 + i)}
          </button>
        ))}
      </div>
      {filled.length ? (
        <table className="flat compare-table">
          <thead>
            <tr>
              <th></th>
              {filled.map((f) => <th key={f.i}>{String.fromCharCode(65 + f.i)}</th>)}
            </tr>
          </thead>
          <tbody>
            {filled.map((f) => {
              const d = f.data;
              return (
                <tr key={f.i}>
                  <th>
                    <span className="slot-title">{String.fromCharCode(65 + f.i)}</span>
                    <span className="muted">{props.slots[f.i]?.label ?? ""}</span>
                  </th>
                  <td>
                    <table className="mini">
                      <tbody>
                        <tr><td>Price</td><td className="num">{aud(d.summary.price)}</td></tr>
                        <tr><td>Gov share</td><td className="num">{pct(d.summary.govPct)} · {aud(d.summary.govShare)}</td></tr>
                        <tr><td>Your loan</td><td className="num">{aud(d.summary.buyerLoan)} (LVR {pct(d.summary.lvr)})</td></tr>
                        <tr><td>Repayment</td><td className="num">{d.summary.repay}</td></tr>
                        <tr><td>Interest overall</td><td className="num">{aud(d.summary.totalInterest)}</td></tr>
                        <tr><td>Cash needed</td><td className="num">{aud(d.summary.deposit)}</td></tr>
                        <tr><td className="muted">Cap</td><td className="num muted">{d.summary.cap ? `${aud(d.summary.cap)} ${d.summary.capOk ? "ok" : "over"}` : "-"}</td></tr>
                      </tbody>
                    </table>
                    <div className="slot-actions">
                      <button className="btn mini" onClick={() => props.expandSlot(f.i)}>Load</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="muted">Nothing saved yet. Set one home here, save it into a slot with the buttons above, then change the numbers and save the next. Nice for comparing the same deposit across houses.</p>
      )}
    </Section>
  );
}
