/**
 * Help to Buy calculation engine. Pure functions, no React.
 *
 * Scheme mechanics verified against (23 Oct 2026):
 *  - firsthomebuyers.gov.au scheme page, FAQs, Repayment Guide, Customer Guide v260701
 *  - CBA scheme page (CSP range 5-30% existing / 5-40% new; DP+CSP >= 20% => LVR <= 80%)
 *  - Official "Maximum Purchase Price calculator": maxPrice = (deposit + loan) / (1 - maxCSP)
 */

import {
  CSP,
  PRICE_CAPS,
  RULES,
  incomeCapFor,
  maxCspShare,
  type HomeType,
  type StateCode,
} from "./constants";

export type ApplicantType = "single" | "singleParent" | "joint";
export type Freq = "weekly" | "fortnightly" | "monthly";

export const PERIODS_PER_YEAR: Record<Freq, number> = { weekly: 52, fortnightly: 26, monthly: 12 };

export type BuybackPlan = {
  enabled: boolean;
  startYear: number;       // first year after settlement (= year 1..)
  percentPerYear: number;  // of the property's value in that year (>= minimum 5%)
  fundByLoan: boolean;     // else funded from savings
};

export type Improvement = {
  year: number;
  cost: number;
  valueUplift: number;     // your estimate of the value the works add (verification valuation in reality)
};

export type Inputs = {
  applicantType: ApplicantType;
  combinedIncome: number;      // annual taxable income for the income cap
  state: StateCode;
  region: "major" | "rest";
  homeType: HomeType;

  homeValue: number;
  deposit: number;
  maxLoan: number;             // most the bank will lend you (on the buyer's share)
  govShareMode: "gap" | "custom";
  customGovSharePct: number;   // when mode = "custom"

  termYears: number;
  ratePct: number;
  freq: Freq;
  extraRepayment: number;      // extra per period

  growthPct: number;
  incomeGrowthPct: number;
  incAboveCapFromYear: number; // 0 = never; optional forced-buy-back modeling

  buyback: BuybackPlan;
  improvement: Improvement | null;
  sellAfterYear: number;       // 0 = don't model a sale
  agentPct: number;
  saleLegalFees: number;

  otherUpfrontCosts: number;
  dutyManual: number | null;
  ongoingMonthlyCosts: number;

  hecsPct: number;
  otherMonthlyDebt: number;
  livingMonthly: number;
};

export type Check = {
  id: string;
  label: string;
  ok: "yes" | "no" | "check";
  detail: string;
};

export type Structure = {
  homeValue: number;
  deposit: number;
  govShareLimit: number;
  govShare: number;        // CSP dollars
  govSharePct: number;
  buyerShare: number;      // dollars (value − CSP)
  buyerLoan: number;       // dollars (buyerShare − deposit)
  lvr: number;
  scans: {
    depositOk: boolean;
    lvrOk: boolean;
    cspInRange: boolean;
    capOk: boolean;
    cap: number | null;
  };
  maxAffordablePrice: number; // official calculator formula
  shortfall: number;
};

export function capFor(state: StateCode, region: "major" | "rest"): number | null {
  const caps = PRICE_CAPS[state];
  return region === "major" ? caps.major : caps.rest;
}

/**
 * "Gap mode": you contribute the maximum deposit you can and borrow the most the bank lends;
 * the government bridges the remainder, up to 30%/40%.
 * Official example (Customer Guide): $800k home, $16k deposit, $544k loan -> CSP $240k (30%), LVR 68%.
 */
export function structureFromFinance(p: {
  homeValue: number;
  deposit: number;
  maxLoan: number;
  homeType: HomeType;
  state: StateCode;
  region: "major" | "rest";
}): Structure {
  const V = Math.max(0, p.homeValue);
  const D = Math.max(0, p.deposit);
  const L = Math.max(0, p.maxLoan);
  const maxCsp = maxCspShare(p.homeType);

  const rawGap = V - D - L;
  const govShare = Math.max(0, Math.min(maxCsp * V, rawGap));
  const buyerLoan = Math.max(0, V - D - govShare);
  const buyerShare = V - govShare;

  const cap = capFor(p.state, p.region);
  const capOk = cap === null ? true : V <= cap;
  const maxAffordablePrice = Math.floor((D + L) / (1 - maxCsp));
  const shortfall = Math.max(0, rawGap - maxCsp * V);

  const govSharePct = V > 0 ? govShare / V : 0;
  const lvr = V > 0 ? buyerLoan / V : 0;
  const depPct = V > 0 ? D / V : 0;

  return {
    homeValue: V,
    deposit: D,
    govShareLimit: maxCsp * V,
    govShare,
    govSharePct,
    buyerShare,
    buyerLoan,
    lvr,
    scans: {
      depositOk: depPct >= RULES.minDepositShare - 1e-9,
      lvrOk: lvr <= RULES.maxLvr + 1e-9,
      cspInRange: govShare > 0 && govSharePct >= CSP.min - 1e-9 && govSharePct <= maxCsp + 1e-9,
      capOk,
      cap,
    },
    maxAffordablePrice,
    shortfall,
  };
}

/** Custom-share mode: you pick the CSP% (within limits) and the loan is what remains. */
export function structureCustom(p: {
  homeValue: number;
  deposit: number;
  customGovSharePct: number;
  homeType: HomeType;
  state: StateCode;
  region: "major" | "rest";
}): Structure {
  const V = Math.max(0, p.homeValue);
  const D = Math.max(0, p.deposit);
  const maxCsp = maxCspShare(p.homeType);
  const govShare = Math.max(0, Math.min(maxCsp * V, (p.customGovSharePct / 100) * V));
  const buyerLoan = Math.max(0, V - govShare - D);
  const buyerShare = V - govShare;

  const cap = capFor(p.state, p.region);
  const capOk = cap === null ? true : V <= cap;
  const govSharePct = V > 0 ? govShare / V : 0;
  const lvr = V > 0 ? buyerLoan / V : 0;
  const depPct = V > 0 ? D / V : 0;
  const maxAffordablePrice = Math.floor((D + buyerLoan) / Math.max(0.2, 1 - govSharePct));

  return {
    homeValue: V,
    deposit: D,
    govShareLimit: maxCsp * V,
    govShare,
    govSharePct,
    buyerShare,
    buyerLoan,
    lvr,
    scans: {
      depositOk: depPct >= RULES.minDepositShare - 1e-9,
      lvrOk: lvr <= RULES.maxLvr + 1e-9,
      cspInRange: govShare > 0 && govSharePct >= CSP.min - 1e-9 && govSharePct <= maxCsp + 1e-9,
      capOk,
      cap,
    },
    maxAffordablePrice,
    shortfall: Math.max(0, V - D - buyerLoan - govShare),
  };
}

/* ------------------------------- mortgage -------------------------------- */

export function repayment(loan: number, ratePct: number, termYears: number, freq: Freq): number {
  return repaymentFull(loan, ratePct, termYears, freq, 0).amount;
}

export type LoanStats = { amount: number; payYears: number; totalInterest: number; nPeriods: number };

/**
 * Bank-style per-period repayment: nominal annual rate ÷ periods per year.
 * `extra` is an additional amount paid every period.
 */
export function repaymentFull(
  loan: number,
  ratePct: number,
  termYears: number,
  freq: Freq,
  extra: number,
): LoanStats {
  const ppy = PERIODS_PER_YEAR[freq];
  const i = ratePct / 100 / ppy;
  const n = Math.max(1, Math.round(termYears * ppy));
  const L = Math.max(0, loan);
  if (L === 0) return { amount: 0, payYears: 0, totalInterest: 0, nPeriods: 0 };

  const base = i === 0 ? L / n : (L * i) / (1 - Math.pow(1 + i, -n));
  const amount = base + extra;
  if (amount <= 0) return { amount: 0, payYears: NaN, totalInterest: NaN, nPeriods: Infinity };

  let bal = L;
  let periods = 0;
  let interest = 0;
  const capPeriods = 41 * ppy;
  while (bal > 0 && periods < capPeriods) {
    const int = bal * i;
    interest += int;
    bal = bal + int - amount;
    if (bal <= 0) { bal = 0; periods++; break; }
    periods++;
  }
  return {
    amount,
    payYears: periods / ppy,
    totalInterest: interest,
    nPeriods: periods,
  };
}

/* ------------------------------ projection ------------------------------- */

export type YearRow = {
  year: number;
  homeValue: number;
  cspPct: number;
  cspValue: number;
  buyerSharePct: number;
  buyerFractionDollar: number; // buyer share of the property value
  loanBalance: number;         // buyer's home loan balance (incl. any buy-back borrowing)
  buyerEquityDollar: number;   // buyerFractionDollar − loanBalance
};

export type BuybackSummary = {
  payments: number;           // how many buy-backs were modeled
  totalPaid: number;          // dollars paid to the Commonwealth across all modeled payments
  firstYear: number | null;   // year the first payment landed (null = none modeled)
  fullOwnershipYear: number | null; // year the CSP reached zero (null = not within horizon)
};

export type SoldAt = {
  year: number;
  salePrice: number;
  costs: number;              // agent % + legal
  loanPayout: number;
  govPayout: number;          // CSP value (share × greater of price / valuation; we use price)
  yourNet: number;            // before tax
};

export type Projection = { rows: YearRow[]; events: string[]; soldAt: SoldAt | null; buybackSummary: BuybackSummary };

/**
 * Anniversary-level projection. Year 0 = settlement.
 *
 * Models (all sourced from the official guides):
 *  - value path with growth; an improvement bumps the path from its year (Vpre + uplift).
 *  - improvement ≥ $21k (FY26-27) adjusts CSP%: CSPpre × Vpre / Vpost (Customer Guide).
 *  - planned buy-backs: ≥ 5% of current value, rounded to nearest $1,000, from startYear.
 *  - optional forced buy-back (over income cap 2 consecutive FYs): one minimum-sized payment.
 *  - buy-backs funded by a loan increase ride on the loan balance (repayments must be re-quoted by the lender).
 *  - sale at year N: waterfall in the Guide's payout order.
 */
export function project(inp: Inputs, s: Structure): Projection {
  const events: string[] = [];
  const ppy = PERIODS_PER_YEAR[inp.freq];
  const g = inp.growthPct / 100;

  const imp = inp.improvement;
  const horizon = Math.max(
    40,
    inp.sellAfterYear,
    imp ? imp.year : 0,
    inp.buyback.enabled ? inp.buyback.startYear + 45 : 0,
    inp.incAboveCapFromYear + 2,
  );

  // value path
  const values: number[] = [];
  for (let t = 0; t <= horizon; t++) {
    if (imp && imp.year > 0 && t === imp.year - 1) {
      // remember pre value
    }
    values.push(s.homeValue * Math.pow(1 + g, t));
  }
  if (imp && imp.year >= 1 && imp.year <= horizon) {
    const vPre = imp.year > 1 ? values[imp.year - 1] : s.homeValue;
    const vPost = vPre + Math.max(0, imp.valueUplift);
    values[imp.year] = vPost;
    for (let t = imp.year + 1; t <= horizon; t++) values[t] = vPost * Math.pow(1 + g, t - imp.year);
  }

  // amortisation (before any loan-increase buy-backs)
  const loanStats = repaymentFull(s.buyerLoan, inp.ratePct, inp.termYears, inp.freq, inp.extraRepayment);
  const baseBalance: number[] = [];
  for (let t = 0; t <= horizon; t++) {
    const period = Math.floor(t * ppy);
    const within = loanStats.nPeriods;
    baseBalance.push(period >= within ? 0 : simulateBalance(s.buyerLoan, inp.ratePct, ppy, inp.freq, inp.extraRepayment, period));
  }

  let cspPct = s.govSharePct;
  let extraFundedLoan = 0;
  const rows: YearRow[] = [];
  const buybackSummary: BuybackSummary = { payments: 0, totalPaid: 0, firstYear: null, fullOwnershipYear: null };

  // forced buy-back (minimum payment), if modeled
  const forcedYear = inp.incAboveCapFromYear > 0 ? inp.incAboveCapFromYear : -1;

  for (let t = 0; t <= horizon; t++) {
    const V = values[t];
    let cspDollars = cspPct * V; // the share is a % of current value; dollars float with the market

    if (t > 0 && imp && imp.year === t && imp.valueUplift > 0) {
      // Customer Guide: the share's dollar value is held at the pre-modification value, so
      //   CSP%post = CSP%pre × Vpre / Vpost
      const vPre = values[t - 1];
      cspPct = (cspPct * vPre) / V;
      cspDollars = cspPct * V;
      events.push(
        `Year ${t}: improvement of $${Math.round(imp.valueUplift).toLocaleString()} — CSP becomes ${(cspPct * 100).toFixed(2)}% (CSP% × Vpre ÷ Vpost)`,
      );
    }

    if (inp.buyback.enabled && t >= inp.buyback.startYear && t > 0 && cspPct > 0.0001) {
      const planned = Math.max(RULES.minBuybackShareOfValue, inp.buyback.percentPerYear / 100) * V;
      let pay = Math.min(cspDollars, Math.round(planned / RULES.buybackRoundTo) * RULES.buybackRoundTo);
      if (cspPct <= RULES.minBuybackShareOfValue) pay = cspDollars; // below 5% of value: repay the remaining share in full
      if (pay > 0) {
        const oldPct = cspPct;
        cspPct = Math.max(0, cspPct - pay / V);
        cspDollars = cspPct * V;
        if (inp.buyback.fundByLoan) extraFundedLoan += pay;
        events.push(
          `Year ${t}: buy-back $${Math.round(pay).toLocaleString()}${inp.buyback.fundByLoan ? " (loan increase)" : " (savings)"} — CSP ${(oldPct * 100).toFixed(2)}% → ${(cspPct * 100).toFixed(2)}%`,
        );
        buybackSummary.payments++;
        buybackSummary.totalPaid += pay;
        if (buybackSummary.firstYear === null) buybackSummary.firstYear = t;
      }
    } else if (t === forcedYear && t > 0 && cspPct > 0.0001) {
      const minPay = Math.min(cspPct * V, Math.round((RULES.minBuybackShareOfValue * V) / RULES.buybackRoundTo) * RULES.buybackRoundTo);
      if (minPay > 0) {
        const oldPct = cspPct;
        cspPct = Math.max(0, cspPct - minPay / V);
        cspDollars = cspPct * V;
        events.push(`Year ${t}: minimum forced buy-back $${Math.round(minPay).toLocaleString()} — CSP ${(oldPct * 100).toFixed(2)}% → ${(cspPct * 100).toFixed(2)}% (review · affordability-gated)`);
        buybackSummary.payments++;
        buybackSummary.totalPaid += minPay;
        if (buybackSummary.firstYear === null) buybackSummary.firstYear = t;
      }
    }
    if (buybackSummary.fullOwnershipYear === null && cspPct <= 0.0001 && t > 0) {
      buybackSummary.fullOwnershipYear = t;
    }

    const loanBalance = Math.max(0, baseBalance[t] + extraFundedLoan);
    const buyerFraction = Math.max(0, V - cspDollars);
    rows.push({
      year: t,
      homeValue: V,
      cspPct: V > 0 ? cspDollars / V : 0,
      cspValue: cspDollars,
      buyerSharePct: V > 0 ? buyerFraction / V : 1,
      buyerFractionDollar: buyerFraction,
      loanBalance,
      buyerEquityDollar: buyerFraction - loanBalance,
    });
  }

  let soldAt: SoldAt | null = null;
  if (inp.sellAfterYear > 0 && inp.sellAfterYear <= horizon) {
    const row = rows[inp.sellAfterYear];
    const salePrice = row.homeValue;
    const costs = salePrice * (inp.agentPct / 100) + inp.saleLegalFees;
    const loanPayout = row.loanBalance;
    const govPayout = row.cspValue;
    soldAt = {
      year: inp.sellAfterYear,
      salePrice,
      costs,
      loanPayout,
      govPayout,
      yourNet: salePrice - costs - loanPayout - govPayout,
    };
  }

  return { rows, events, soldAt, buybackSummary };
}

function simulateBalance(
  loan: number,
  ratePct: number,
  ppy: number,
  freq: Freq,
  extra: number,
  periods: number,
): number {
  const { amount } = repaymentFull(loan, ratePct, 40, freq, extra);
  const i = ratePct / 100 / ppy;
  let bal = loan;
  for (let p = 0; p < periods; p++) {
    const int = bal * i;
    bal = bal + int - amount;
    if (bal <= 0) return 0;
  }
  return bal;
}

/* ---------------------------- serviceability ----------------------------- */

/**
 * Rough borrowing capacity from income: monthly surplus after living costs, HECS haircut and
 * other debts, applied at the STRESSED rate (rate + APRA 3% buffer). A lender's real
 * assessment (CBA's) differs — present this as a heuristic, never a quote.
 */
export function borrowingCapacity(p: {
  grossIncome: number;
  livingMonthly: number;
  otherMonthlyDebt: number;
  hecsPct: number;
  ratePct: number;
  termYears: number;
}): number {
  const incomeMonthly = (p.grossIncome / 12) * (1 - (p.hecsPct || 0) / 100);
  const capacityMonthly = Math.max(0, incomeMonthly - p.livingMonthly - p.otherMonthlyDebt) * 0.826;
  const stressed = p.ratePct + RULES.apraServiceabilityBuffer * 100;
  const i = stressed / 100 / 12;
  const n = Math.max(1, p.termYears * 12);
  if (i === 0) return Math.floor(capacityMonthly * n);
  return Math.floor(capacityMonthly * (1 - Math.pow(1 + i, -n)) / i);
}

/* ------------------------------ eligibility ------------------------------ */

export function eligibility(inp: Inputs, s: Structure): Check[] {
  const cap = incomeCapFor(inp.applicantType);
  const overCap = inp.combinedIncome > cap;
  const typeLabel =
    inp.applicantType === "single" ? "single" : inp.applicantType === "singleParent" ? "single parent" : "joint";
  const checks: Check[] = [];

  checks.push({
    id: "income",
    label: `Income cap — ${typeLabel} · FY 2026-27`,
    ok: overCap ? "no" : "yes",
    detail: overCap
      ? `Over the $${cap.toLocaleString()} cap by $${Math.round(inp.combinedIncome - cap).toLocaleString()}. Assessed on your prior-FY Notice of Assessment; strict — no exemptions.`
      : `$${cap.toLocaleString()} cap ✓ on your prior-FY Notice of Assessment. Indexes each 1 July (next: 1 Jul 2027). During participation, reviews every ≤ 5 years count two consecutive FYs over cap.`,
  });

  checks.push({
    id: "deposit",
    label: "Minimum 2% deposit",
    ok: s.scans.depositOk ? "yes" : "no",
    detail: s.scans.depositOk
      ? `$${Math.round(s.deposit).toLocaleString()} is ${(s.deposit / Math.max(1, s.homeValue) * 100).toFixed(1)}% of the price. You must also front duty, legal and inspection costs (concessions can combine — see duty module).`
      : `Need ≥ $${Math.round(RULES.minDepositShare * s.homeValue).toLocaleString()} for a $${Math.round(s.homeValue).toLocaleString()} home — and to “contribute what you reasonably can” above it.`,
  });

  checks.push({
    id: "lvr",
    label: "Deposit + government share ≥ 20% · no LMI",
    ok: s.scans.lvrOk ? "yes" : "no",
    detail: s.scans.lvrOk
      ? `Loan-to-value ${(s.lvr * 100).toFixed(1)}% — LMI not required. (“Potential LMI saving of thousands” per the Customer Guide.)`
      : `With the government share maxed, the remaining stake is over 80% — reduce the price, raise the deposit, or get a smaller loan.`,
  });

  checks.push({
    id: "csp",
    label: "Government share within 5–30% existing / 5–40% new",
    ok: s.scans.cspInRange ? "yes" : "check",
    detail: s.govShare > 0
      ? `${(s.govSharePct * 100).toFixed(1)}% of the price. No interest or rent is charged on this share — it is repaid as a % of value at sale/buy-back.`
      : "No gap to bridge — the lender’s capacity test may rule the scheme out (the 5% Deposit Scheme may suit instead).",
  });

  checks.push({
    id: "cap",
    label: "Price cap for the location",
    ok: s.scans.cap === null ? "check" : s.scans.capOk ? "yes" : "no",
    detail:
      s.scans.cap === null
        ? "No cap applies for this region entry — verify the suburb/postcode with the official postcode tool."
        : s.scans.capOk
          ? `Cap $${s.scans.cap.toLocaleString()} — this price is $${Math.round(s.scans.cap - s.homeValue).toLocaleString()} under it.`
          : `Cap $${s.scans.cap.toLocaleString()} — $${Math.round(s.homeValue - s.scans.cap).toLocaleString()} over. Caps are NOT indexed; check the official postcode tool.`,
  });

  checks.push({
    id: "loan",
    label: "P&I home loan from a Participating Lender (≤ 30 years)",
    ok: "yes",
    detail: `Modeled at ${inp.termYears} years, ${inp.ratePct}% . Interest-only is only allowed during construction. CommBank and Bank Australia et al. are on the current panel.`,
  });

  return checks;
}

/** Total cash you need at settlement (deposit + duty + selling/buying costs). */
export function upfrontCash(inp: Inputs, s: Structure, dutyEstimate: number | null): number {
  const duty = inp.dutyManual ?? (dutyEstimate ?? 0);
  return s.deposit + duty + inp.otherUpfrontCosts;
}

/** The official Customer Guide example — a sensible neutral starting point. */
export const initialInputs: Inputs = {
  applicantType: "single",
  combinedIncome: 95_000,
  state: "NSW",
  region: "major",
  homeType: "existing",
  homeValue: 800_000,
  deposit: 16_000,
  maxLoan: 544_000,
  govShareMode: "gap",
  customGovSharePct: 30,
  termYears: 30,
  ratePct: 5.5,
  freq: "monthly",
  extraRepayment: 0,
  growthPct: 3,
  incomeGrowthPct: 2.5,
  incAboveCapFromYear: 0,
  buyback: { enabled: false, startYear: 5, percentPerYear: 5, fundByLoan: false },
  improvement: null,
  sellAfterYear: 0,
  agentPct: 2.5,
  saleLegalFees: 2_000,
  otherUpfrontCosts: 4_750,
  dutyManual: null,
  ongoingMonthlyCosts: 520,
  hecsPct: 0,
  otherMonthlyDebt: 0,
  livingMonthly: 2_000,
};
