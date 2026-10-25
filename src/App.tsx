import { useEffect, useMemo, useState } from "react";
import {
  borrowingCapacity,
  eligibility,
  initialInputs as DEFAULT_INPUTS,
  project,
  repaymentFull,
  structureCustom,
  structureFromFinance,
  upfrontCash,
  type CheckFix,
  type Freq,
  type Inputs,
} from "./lib/engine";
import { roughDuty } from "./lib/duty";
import { SOURCES, type StateCode } from "./lib/constants";
import { aud } from "./lib/format";
import InputPanel from "./components/InputPanel";
import ListingImport from "./components/ListingImport";
import Wizard from "./components/Wizard";
import { Results, type LoanSnapshot } from "./components/Results";
import Compare, { summarize, type Slot } from "./components/Compare";
import { TermsPage, PrivacyPage } from "./components/Legal";
import { Section } from "./components/ui";

const SLOTS_KEY = "helpbuy.studio.slots.v1";
const STATE_KEY = "helpbuy.studio.state.v1";
const ONBOARD_KEY = "helpbuy.studio.onboarded.v1";

/* --------------------------- local persistence ----------------------------- */

type StoredState = { v: 1; current: Inputs };

function loadStoredState(): Inputs | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    if (parsed.v !== 1) return null;
    return mergeInputs(parsed.current);
  } catch {
    return null;
  }
}

function saveStoredState(inputs: Inputs): void {
  try {
    const stored: StoredState = { v: 1, current: inputs };
    localStorage.setItem(STATE_KEY, JSON.stringify(stored));
  } catch {
    /* private mode / quota - the app keeps working without persistence */
  }
}

/* ------------------------- shareable state (URL hash) ------------------------ */

function encodeState(inputs: Inputs): string {
  const json = JSON.stringify(inputs);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeState(hash: string): Inputs | null {
  try {
    const b64 = hash.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64)));
    const partial = JSON.parse(json) as Partial<Inputs>;
    return mergeInputs(partial);
  } catch {
    return null;
  }
}

function mergeInputs(p: Partial<Inputs>): Inputs {
  return {
    ...DEFAULT_INPUTS,
    ...p,
    buyback: { ...DEFAULT_INPUTS.buyback, ...(p.buyback ?? {}) },
  };
}

/* --------------------------------- computed --------------------------------- */

function computeLoan(inputs: Inputs, buyerLoan: number) {
  const freqs: Freq[] = ["weekly", "fortnightly", "monthly"];
  const amounts: Partial<Record<Freq, number>> = {};
  for (const f of freqs) amounts[f] = repaymentFull(buyerLoan, inputs.ratePct, inputs.termYears, f, inputs.extraRepayment).amount;
  const chosen = repaymentFull(buyerLoan, inputs.ratePct, inputs.termYears, inputs.freq, inputs.extraRepayment);
  const stressed = repaymentFull(buyerLoan, inputs.ratePct + 3, inputs.termYears, inputs.freq, inputs.extraRepayment);
  return {
    snapshot: {
      freq: inputs.freq,
      amounts: amounts as Record<string, number>,
      payYears: chosen.payYears,
      totalInterest: chosen.totalInterest,
      stressedAmount: stressed.amount,
    } satisfies LoanSnapshot,
    chosen,
  };
}

/* ----------------------------------- App ----------------------------------- */

export default function App() {
  const path = location.pathname;
  if (path.endsWith("/terms")) return <TermsPage />;
  if (path.endsWith("/privacy")) return <PrivacyPage />;

  return <Planner />;
}

function Planner() {
  const [showWizard, setShowWizard] = useState(() => {
    // A shared link means you already know what you want: skip the wizard.
    if (location.hash.length > 2) return false;
    try { return localStorage.getItem(ONBOARD_KEY) !== "done"; } catch { return false; }
  });
  const [inputs, setInputs] = useState<Inputs>(() => {
    const hash = location.hash.replace(/^#/, "");
    // Shared link wins → then whatever you last had on this device → then the example.
    return decodeState(hash) ?? loadStoredState() ?? DEFAULT_INPUTS;
  });
  const [toast, setToast] = useState("");
  const [slots, setSlots] = useState<Slot[]>(() => {
    try {
      const raw = localStorage.getItem(SLOTS_KEY);
      if (raw) return JSON.parse(raw) as Slot[];
    } catch { /* ignore */ }
    return [null, null, null].map((_, i) => ({ label: `Scenario ${"ABC"[i]}`, inputs: null }));
  });

  useEffect(() => {
    history.replaceState(null, "", "#" + encodeState(inputs));
    saveStoredState(inputs);
  }, [inputs]);

  useEffect(() => {
    try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); } catch { /* ignore */ }
  }, [slots]);

  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setInputs((p) => ({ ...p, [k]: v }));

  function patchInputs(p: Partial<Inputs>) {
    setInputs((prev) => ({ ...prev, ...p, buyback: { ...prev.buyback, ...(p.buyback ?? {}) } }));
  }

  function finishWizard(message = "You're set up - every number is still editable.") {
    try { localStorage.setItem(ONBOARD_KEY, "done"); } catch { /* ignore */ }
    setShowWizard(false);
    setToast(message);
    setTimeout(() => setToast(""), 3600);
  }

  function useDefaults() {
    try { localStorage.removeItem(STATE_KEY); } catch { /* ignore */ }
    setInputs({ ...DEFAULT_INPUTS, buyback: { ...DEFAULT_INPUTS.buyback } });
    finishWizard("Defaults loaded: $800,000 home, 30% government share, 6.55% rate. Change anything you like.");
  }

  function restartWizard() {
    try { localStorage.removeItem(ONBOARD_KEY); } catch { /* ignore */ }
    setShowWizard(true);
  }

  const structure = useMemo(
    () =>
      inputs.govShareMode === "custom"
        ? structureCustom({
            homeValue: inputs.homeValue,
            valuation0: inputs.valuation0,
            deposit: inputs.deposit,
            customGovSharePct: inputs.customGovSharePct,
            homeType: inputs.homeType,
            state: inputs.state as StateCode,
            region: inputs.region,
          })
        : structureFromFinance({
            homeValue: inputs.homeValue,
            valuation0: inputs.valuation0,
            deposit: inputs.deposit,
            maxLoan: inputs.maxLoan,
            homeType: inputs.homeType,
            state: inputs.state as StateCode,
            region: inputs.region,
          }),
    [inputs.homeValue, inputs.valuation0, inputs.deposit, inputs.maxLoan, inputs.customGovSharePct, inputs.govShareMode, inputs.homeType, inputs.state, inputs.region],
  );

  const dutyEstimate = useMemo(
    () => roughDuty(inputs.state as StateCode, structure.buyerShare),
    [inputs.state, structure.buyerShare],
  );

  const projection = useMemo(() => project(inputs, structure), [inputs, structure]);
  const { snapshot: loan } = useMemo(() => computeLoan(inputs, structure.buyerLoan), [inputs, structure.buyerLoan]);
  const checks = useMemo(() => eligibility(inputs, structure), [inputs, structure]);
  const upfront = useMemo(() => upfrontCash(inputs, structure, dutyEstimate), [inputs, structure, dutyEstimate]);
  const capacity = useMemo(
    () =>
      borrowingCapacity({
        grossIncome: inputs.combinedIncome,
        livingMonthly: inputs.livingMonthly,
        otherMonthlyDebt: inputs.otherMonthlyDebt,
        hecsPct: inputs.hecsPct,
        ratePct: inputs.ratePct,
        termYears: inputs.termYears,
      }),
    [inputs.combinedIncome, inputs.livingMonthly, inputs.otherMonthlyDebt, inputs.hecsPct, inputs.ratePct, inputs.termYears],
  );

  const compareCompute = (inp: Inputs) => {
    const s =
      inp.govShareMode === "custom"
        ? structureCustom({ homeValue: inp.homeValue, valuation0: inp.valuation0, deposit: inp.deposit, customGovSharePct: inp.customGovSharePct, homeType: inp.homeType, state: inp.state as StateCode, region: inp.region })
        : structureFromFinance({ homeValue: inp.homeValue, valuation0: inp.valuation0, deposit: inp.deposit, maxLoan: inp.maxLoan, homeType: inp.homeType, state: inp.state as StateCode, region: inp.region });
    const { snapshot } = computeLoan(inp, s.buyerLoan);
    return { s, loan: snapshot, summary: summarize(inp, s, snapshot) };
  };

  async function share() {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied. It has all your numbers in it.");
    } catch {
      setToast("Copy failed, but the address bar URL is your shareable link.");
    }
    setTimeout(() => setToast(""), 3500);
  }

  function saveSlot(i: number) {
    setSlots((prev) =>
      prev.map((sl, idx) =>
        idx === i ? { label: `${inputs.homeType} · ${aud(inputs.homeValue)}`, inputs: { ...inputs } } : sl,
      ),
    );
    setToast(`Scenario saved to ${String.fromCharCode(65 + i)}.`);
    setTimeout(() => setToast(""), 3000);
  }

  function enableBuyback() {
    set("buyback", {
      ...inputs.buyback,
      enabled: true,
      startYear: Math.max(1, inputs.buyback.startYear) || 3,
      percentPerYear: inputs.buyback.percentPerYear || 5,
    });
    setToast("Buy-back plan added. See Path to full ownership (section 04).");
    setTimeout(() => setToast(""), 3200);
  }

  /** One-click remedies from the rules check: set whichever input the fix names. */
  function applyFix(fix: CheckFix) {
    if (fix.kind === "share") patchInputs({ govShareMode: "custom", customGovSharePct: fix.value });
    else if (fix.kind === "deposit") patchInputs({ deposit: fix.value });
    else if (fix.kind === "price") patchInputs({ homeValue: fix.value });
    else patchInputs({ maxLoan: fix.value });
    setToast("Changed. The checks update straight away.");
    setTimeout(() => setToast(""), 3000);
  }

  function startOver() {    try { localStorage.removeItem(STATE_KEY); } catch { /* ignore */ }
    setInputs({ ...DEFAULT_INPUTS });
    setToast("Back to the example. Your A / B / C compare slots are still saved.");
    setTimeout(() => setToast(""), 3000);
  }

  function loadSlot(i: number) {
    const sl = slots[i];
    if (sl?.inputs) {
      setInputs(mergeInputs(sl.inputs));
      setToast(`Loaded ${String.fromCharCode(65 + i)}.`);
      setTimeout(() => setToast(""), 2500);
    }
  }

  return (
    <div className="page">
      <header className="site-head" role="banner">
        <div>
          <h1>Help to Buy <span className="two">Studio</span></h1>
          <p className="sub">
            Plan repayments, equity, buy-backs and sales for the Australian Government Help to Buy scheme.
            Free, no sign-up, and your numbers stay in this browser.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={startOver} title="Clear this scenario and load the example numbers">Reset to defaults</button>
          <button className="btn" onClick={share}>Share this scenario</button>
          <button className="btn" onClick={() => window.print()}>Print</button>
        </div>
      </header>

      <p className="notice">
        General information only, not financial advice, and not a quote - read the{" "}
        <a href="/terms">terms of use</a> and <a href="/privacy">privacy policy</a>.
      </p>

      {showWizard ? (
        <Wizard inputs={inputs} set={patchInputs} done={finishWizard} useDefaults={useDefaults} />
      ) : (
        <>
          <ListingImport onApply={patchInputs} />

          <main className="main-grid">
        <aside className="col-inputs" aria-label="Inputs">
          <InputPanel inputs={inputs} set={set} maxAffordable={structure.maxAffordablePrice} />
        </aside>
        <div className="col-results">
          <Results
            inputs={inputs}
            structure={structure}
            projection={projection}
            loan={loan}
            checks={checks}
            dutyEstimate={dutyEstimate}
            upfront={upfront}
            capacity={{ estimate: capacity, against: structure.buyerLoan }}
            setSellYear={(y) => set("sellAfterYear", y)}
            setFreq={(f) => set("freq", f)}
            onEnableBuyback={enableBuyback}
            onFix={applyFix}
          />
          <Compare
            slots={slots}
            compute={compareCompute}
            expandToInputs={() => undefined}
            collapseToSlot={saveSlot}
            expandSlot={loadSlot}
          />
          <Section title="Notes" id="notes">
            <ul className="plain notes-list">
              <li><button className="mini-cta" onClick={restartWizard}>Run the guided setup again</button> - the three step intro: who is buying, the home, the loan. Its <strong>Use the defaults</strong> button skips the questions and loads the official example.</li>
              <li><strong>Where your numbers live:</strong> this browser only. The open scenario and the A / B / C
                slots sit in localStorage, nothing is sent anywhere, and there's no account. A shared link simply
                puts your numbers in the URL; Reset to defaults clears the saved scenario and loads the
                official example.</li>
              <li><strong>Your lender is the key contact.</strong> They check your finances, lodge the application with
                Housing Australia, and confirm final eligibility. This tool is a planner, not a quote. On the current
                panel: CommBank, Bank Australia, Teachers Mutual Bank group, and Queensland Country Bank.</li>
              <li><strong>The government share charges nothing as it goes.</strong> No interest, no rent. But its dollar
                value follows the market: at sale or buy-back the government takes its share of whatever the home is
                worth that day, up or down.</li>
              <li><strong>Why the deposit can be small, and what LMI is:</strong> a 2% deposit plus the government
                share keeps the loan at 80% of the value or less. That matters because above 80% banks charge LMI,
                a one-off insurance fee that protects the bank rather than you and can cost thousands. The checks
                above spell it out and give the exact fix when it applies. Still put in as much as you reasonably
                can - the lender's own income and spending check decides the real numbers.</li>
              <li><strong>Some limits move, some don't:</strong> the income caps rise with wages every 1 July, and the
                $21,000 works threshold is set for FY 2026-27. The area price caps are fixed by the scheme, so a home
                that's over the cap now stays over it.</li>
              <li><strong>Prices here are asking prices.</strong> A lender's valuation can come in lower, which changes the
                share and the loan. Growth rates are your own assumption, not a forecast.</li>
            </ul>
            <p className="fine">
              Data sourced from firsthomebuyers.gov.au and CommBank's scheme pages, fetched 23 Oct 2026 (income caps FY
              2026-27; Customer Guide v260701). Independent tool - not affiliated with Housing Australia, CommBank or any
              listed party. General information only, not financial advice.
            </p>
          </Section>

          <footer className="site-foot">
            <a href="/">Planner</a>
            <a href="/terms">Terms of use</a>
            <a href="/privacy">Privacy policy</a>
            <a href={SOURCES.scheme}>Scheme</a>
            <a href={SOURCES.priceCaps}>Price caps</a>
            <a href={SOURCES.thresholds}>Thresholds</a>
            <a href={SOURCES.repaymentGuide}>Repayment guide</a>
            <a href={SOURCES.customerGuide}>Customer guide</a>
            <a href={SOURCES.factSheet}>Fact sheet</a>
            <a href={SOURCES.tmd}>Target market determination</a>
            <a href={SOURCES.generalTerms}>General terms</a>
            <a href={SOURCES.newBuild}>New build guide</a>
            <a href={SOURCES.homeImprovement}>Improvements guide</a>
            <a href={SOURCES.cbaScheme}>CommBank page</a>
            <a href={SOURCES.maxPriceCalc}>Official max price calculator</a>
          </footer>
        </div>
      </main>
      </>
      )}

      <div className="toast" aria-live="polite">{toast}</div>
    </div>
  );
}
