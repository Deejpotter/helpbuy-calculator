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
  everyYears: number;      // years between payments: 1 = every year, 30 = after each new loan is repaid
  loanTermYears: number;   // 0 = repay each new loan at the first loan's repayment, else spread over this many years
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

  homeValue: number;           // contract price
  valuation0: number | null;   // initial valuation; if below price, percentages are measured on it
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

export type CheckFix =
  | { kind: "share"; value: number; label: string }
  | { kind: "deposit"; value: number; label: string }
  | { kind: "price"; value: number; label: string }
  | { kind: "loan"; value: number; label: string };

export type Check = {
  id: string;
  label: string;
  ok: "yes" | "no" | "check";
  detail: string;      // where you stand, in plain words
  action?: string;     // what to do about it, only when it doesn't pass
  fix?: CheckFix;      // one click that sets the number for you
};

export type Structure = {
  homeValue: number;      // contract price
  valueBase: number;      // min(price, initial valuation): the value percentages use
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
 * "Gap mode": the bank's limit is a CEILING, never the amount borrowed.
 * The government bridges what the deposit and that ceiling can't cover, but never less than the
 * share that keeps the loan at 80% of the value (clause 3.2(b)) - so a generous bank limit does
 * not turn into a loan that attracts LMI. If the deposit alone covers 20%, the share is zero.
 * Official example (Customer Guide): $800k home, $16k deposit, $544k limit -> CSP $240k (30%),
 * loan $544k, LVR 68%.
 */
export function structureFromFinance(p: {
  homeValue: number;
  valuation0?: number | null;
  deposit: number;
  maxLoan: number;
  homeType: HomeType;
  state: StateCode;
  region: "major" | "rest";
}): Structure {
  const V = Math.max(0, p.homeValue);
  const valueBase = Math.max(1, Math.min(V, p.valuation0 ?? V));
  const D = Math.max(0, p.deposit);
  const L = Math.max(0, p.maxLoan);
  const maxCsp = maxCspShare(p.homeType);

  // General Terms clause 6.1: CC = max(0, min(MaxCC, PP - Loan - Deposit)); CC <= 0 -> not eligible.
  const rawCc = Math.max(0, V - D - L);
  // Clause 3.2(b): the share also has to keep the loan at 80% of the value or less. This holds
  // even when the bank would lend the whole gap: the buyer is free to borrow less, and 80%+ means LMI.
  const lvrFloor = Math.max(0, valueBase - RULES.maxLvr * valueBase - D);
  let cc = Math.max(rawCc, lvrFloor);
  // if the government is involved at all, its share is at least the scheme's 5% minimum
  if (cc > 0) cc = Math.max(cc, CSP.min * V);
  cc = Math.min(cc, maxCsp * V);
  const govShare = cc;
  const buyerLoan = Math.max(0, V - D - govShare);
  // Percentages are stated off min(price, initial valuation) - clause 6.3.
  const govSharePct = valueBase > 0 ? (govShare / V) * (V / valueBase) : 0;

  const cap = capFor(p.state, p.region);
  const capOk = cap === null ? true : V <= cap;
  const maxAffordablePrice = Math.floor((D + L) / (1 - maxCsp));
  const shortfall = Math.max(0, rawCc - maxCsp * V);

  const lvr = valueBase > 0 ? buyerLoan / valueBase : 0;
  const depPct = V > 0 ? D / V : 0;

  return {
    homeValue: V,
    valueBase,
    deposit: D,
    govShareLimit: maxCsp * V,
    govShare,
    govSharePct,
    buyerShare: Math.max(0, valueBase * (1 - govSharePct)),
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

/** Custom-share mode: you pick the government share (within limits) and the loan is what remains. */
export function structureCustom(p: {
  homeValue: number;
  valuation0?: number | null;
  deposit: number;
  customGovSharePct: number;
  homeType: HomeType;
  state: StateCode;
  region: "major" | "rest";
}): Structure {
  const V = Math.max(0, p.homeValue);
  const valueBase = Math.max(1, Math.min(V, p.valuation0 ?? V));
  const D = Math.max(0, p.deposit);
  const maxCsp = maxCspShare(p.homeType);
  const govShare = Math.max(0, Math.min(maxCsp * V, (p.customGovSharePct / 100) * V));
  const buyerLoan = Math.max(0, V - govShare - D);

  const cap = capFor(p.state, p.region);
  const capOk = cap === null ? true : V <= cap;
  const govSharePct = valueBase > 0 ? (govShare / V) * (V / valueBase) : 0;
  const lvr = valueBase > 0 ? buyerLoan / valueBase : 0;
  const depPct = V > 0 ? D / V : 0;
  const maxAffordablePrice = Math.floor((D + buyerLoan) / Math.max(0.2, 1 - govSharePct));

  return {
    homeValue: V,
    valueBase,
    deposit: D,
    govShareLimit: maxCsp * V,
    govShare,
    govSharePct,
    buyerShare: Math.max(0, valueBase * (1 - govSharePct)),
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
  years: number[];            // the years those payments landed in
  totalPaid: number;          // dollars paid to the Commonwealth across all modeled payments
  firstYear: number | null;   // year the first payment landed (null = none modeled)
  fullOwnershipYear: number | null; // year the CSP reached zero (null = not within horizon)
  borrowed: number;           // dollars funded by new loans (0 when paid from savings)
  extraRepayment: number;     // per chosen payment period, summed across the new loans
  newLoanTermYears: number;   // 0 = each new loan runs on the first loan's repayment
  perLoanRepayment: number;   // per chosen payment period, for one buy-back loan
  perLoanPayoffYears: number; // how long one buy-back loan takes to clear
};

export type SoldAt = {
  year: number;
  salePrice: number;
  costs: number;              // agent % + legal
  loanPayout: number;
  govPayout: number;          // CSP value (share x greater of price / valuation; we use price)
  yourNet: number;            // before tax
};

export type Projection = { rows: YearRow[]; events: string[]; soldAt: SoldAt | null; buybackSummary: BuybackSummary };

/**
 * Anniversary-level projection. Year 0 = settlement.
 *
 * Models (all sourced from the official guides):
 *  - value path with growth; an improvement bumps the path from its year (Vpre + uplift).
 *  - improvement ≥ $21k (FY26-27) adjusts CSP%: CSPpre x Vpre / Vpost (Customer Guide).
 *  - planned buy-backs: ≥ 5% of current value, rounded to nearest $1,000, from startYear.
 *  - optional forced buy-back (over income cap 2 consecutive FYs): one minimum-sized payment.
 *  - a loan-funded buy-back is a NEW loan of its own: same rate and term, principal and interest.
 *    It amortises separately, so the balance falls again instead of sitting there forever, and
 *    a payment made after the first loan is repaid still shows up as debt.
 *  - sale at year N: waterfall in the Guide's payout order.
 */
export function project(inp: Inputs, s: Structure): Projection {
  const events: string[] = [];
  const ppy = PERIODS_PER_YEAR[inp.freq];
  const g = inp.growthPct / 100;

  const imp = inp.improvement;
  const horizon = Math.min(
    60,
    Math.max(
      40,
      inp.sellAfterYear,
      imp ? imp.year : 0,
      // enough room for up to eight chunks plus the last new loan's own life, within the 60 year cap
      inp.buyback.enabled
        ? inp.buyback.startYear +
            Math.max(1, inp.buyback.everyYears || 1) * 8 +
            (inp.buyback.loanTermYears > 0 ? inp.buyback.loanTermYears : 6)
        : 0,
      inp.incAboveCapFromYear + 2,
    ),
  );

  // value path starts at the settled value (min of price and initial valuation - clause 6.3)
  const values: number[] = [];
  for (let t = 0; t <= horizon; t++) {
    values.push(s.valueBase * Math.pow(1 + g, t));
  }
  if (imp && imp.year >= 1 && imp.year <= horizon) {
    const vPre = imp.year > 1 ? values[imp.year - 1] : s.homeValue;
    const vPost = vPre + Math.max(0, imp.valueUplift);
    values[imp.year] = vPost;
    for (let t = imp.year + 1; t <= horizon; t++) values[t] = vPost * Math.pow(1 + g, t - imp.year);
  }

  // amortisation of the first loan (before any buy-back loans)
  const loanStats = repaymentFull(s.buyerLoan, inp.ratePct, inp.termYears, inp.freq, inp.extraRepayment);
  const baseBalance: number[] = [];
  for (let t = 0; t <= horizon; t++) {
    const period = Math.floor(t * ppy);
    const within = loanStats.nPeriods;
    baseBalance.push(period >= within ? 0 : simulateBalance(s.buyerLoan, inp.ratePct, inp.termYears, ppy, inp.freq, inp.extraRepayment, period));
  }

  let cspPct = s.govSharePct;
  // each loan-funded buy-back is its own new loan at the same rate. By default it is repaid on the
  // same per-period repayment as the first loan, which clears a chunk fast; or spread over a term.
  const newLoanTerm = inp.buyback.loanTermYears > 0 ? Math.min(30, inp.buyback.loanTermYears) : 0;
  const mainRepayment = loanStats.amount; // per period, including any extra repayment
  const newLoans: Array<{ year: number; amount: number }> = [];
  const rows: YearRow[] = [];
  const buybackSummary: BuybackSummary = {
    payments: 0, years: [], totalPaid: 0, firstYear: null, fullOwnershipYear: null,
    borrowed: 0, extraRepayment: 0, newLoanTermYears: newLoanTerm, perLoanRepayment: 0, perLoanPayoffYears: 0,
  };

  // forced buy-back (minimum payment), if modeled
  const forcedYear = inp.incAboveCapFromYear > 0 ? inp.incAboveCapFromYear : -1;

  for (let t = 0; t <= horizon; t++) {
    const V = values[t];
    let cspDollars = cspPct * V; // the share is a % of current value; dollars float with the market

    if (t > 0 && imp && imp.year === t && imp.valueUplift > 0) {
      // Customer Guide: the share's dollar value is held at the pre-modification value, so
      //   CSP%post = CSP%pre x Vpre / Vpost
      const vPre = values[t - 1];
      cspPct = (cspPct * vPre) / V;
      cspDollars = cspPct * V;
      events.push(
        `Year ${t}: improvement of $${Math.round(imp.valueUplift).toLocaleString()}, share drops to ${(cspPct * 100).toFixed(2)}% (scales by value before and after)`,
      );
    }

    if (
      inp.buyback.enabled &&
      t >= inp.buyback.startYear &&
      t > 0 &&
      cspPct > 0.0001 &&
      (t - inp.buyback.startYear) % Math.max(1, inp.buyback.everyYears || 1) === 0
    ) {
      const planned = Math.max(RULES.minBuybackShareOfValue, inp.buyback.percentPerYear / 100) * V;
      let pay = Math.min(cspDollars, Math.round(planned / RULES.buybackRoundTo) * RULES.buybackRoundTo);
      // below 5% of value: repay the remaining share in full
      if (cspPct <= RULES.minBuybackShareOfValue) pay = cspDollars;
      // don't leave a dust payment behind: a residue under the $1,000 rounding is cleared with this one
      if (cspDollars - pay <= RULES.buybackRoundTo) pay = cspDollars;
      if (pay > 0) {
        const oldPct = cspPct;
        cspPct = Math.max(0, cspPct - pay / V);
        cspDollars = cspPct * V;
        let funding = ", from savings";
        if (inp.buyback.fundByLoan) {
          newLoans.push({ year: t, amount: pay });
          funding = baseBalance[t] <= 0 ? ", by a new loan (the first loan is already repaid)" : ", by a new loan";
        }
        events.push(
          `Year ${t}: buy-back of $${Math.round(pay).toLocaleString()}${funding}, government share ${(oldPct * 100).toFixed(2)}% to ${(cspPct * 100).toFixed(2)}%`,
        );
        buybackSummary.payments++;
        buybackSummary.totalPaid += pay;
        buybackSummary.years.push(t);
        if (buybackSummary.firstYear === null) buybackSummary.firstYear = t;
      }
    } else if (t === forcedYear && t > 0 && cspPct > 0.0001) {
      const minPay = Math.min(cspPct * V, Math.round((RULES.minBuybackShareOfValue * V) / RULES.buybackRoundTo) * RULES.buybackRoundTo);
      if (minPay > 0) {
        const oldPct = cspPct;
        cspPct = Math.max(0, cspPct - minPay / V);
        cspDollars = cspPct * V;
        if (inp.buyback.fundByLoan) newLoans.push({ year: t, amount: minPay });
        events.push(`Year ${t}: required buy-back of $${Math.round(minPay).toLocaleString()} (the minimum), government share ${(oldPct * 100).toFixed(2)}% to ${(cspPct * 100).toFixed(2)}% - only ever enforced if you can afford it`);
        buybackSummary.payments++;
        buybackSummary.totalPaid += minPay;
        if (buybackSummary.firstYear === null) buybackSummary.firstYear = t;
      }
    }
    if (buybackSummary.fullOwnershipYear === null && cspPct <= 0.0001 && t > 0) {
      buybackSummary.fullOwnershipYear = t;
    }

    const newLoanBalance = newLoans.reduce(
      (sum, loan) => sum + newLoanBalanceAt(loan, t, inp.ratePct, newLoanTerm, inp.freq, mainRepayment),
      0,
    );
    const loanBalance = Math.max(0, baseBalance[t] + newLoanBalance);
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

  buybackSummary.borrowed = newLoans.reduce((sum, loan) => sum + loan.amount, 0);
  if (newLoans.length > 0) {
    const perLoan = buybackSummary.borrowed / newLoans.length;
    buybackSummary.perLoanRepayment =
      newLoanTerm > 0 ? repaymentFull(perLoan, inp.ratePct, newLoanTerm, inp.freq, 0).amount : mainRepayment;
    buybackSummary.extraRepayment = buybackSummary.perLoanRepayment * newLoans.length;
    buybackSummary.perLoanPayoffYears = payoffYears(perLoan, buybackSummary.perLoanRepayment, inp.ratePct, inp.freq);
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
  termYears: number,
  ppy: number,
  freq: Freq,
  extra: number,
  periods: number,
): number {
  const { amount } = repaymentFull(loan, ratePct, termYears, freq, extra);
  const i = ratePct / 100 / ppy;
  let bal = loan;
  for (let p = 0; p < periods; p++) {
    const int = bal * i;
    bal = bal + int - amount;
    if (bal <= 0) return 0;
  }
  return bal;
}

/**
 * Balance of one buy-back loan at a given year. A buy-back loan is a new principal and interest
 * loan at the user's rate: by default it runs on the first loan's repayment (so a small chunk
 * clears in months), or over the term the user picked.
 */
function newLoanBalanceAt(
  loan: { year: number; amount: number },
  t: number,
  ratePct: number,
  termYears: number,
  freq: Freq,
  mainRepayment: number,
): number {
  const elapsed = t - loan.year;
  if (elapsed < 0) return 0;
  if (elapsed === 0) return loan.amount;
  const ppy = PERIODS_PER_YEAR[freq];
  const payment = termYears > 0 ? repaymentFull(loan.amount, ratePct, termYears, freq, 0).amount : mainRepayment;
  const i = ratePct / 100 / ppy;
  let bal = loan.amount;
  for (let p = 0; p < Math.floor(elapsed * ppy); p++) {
    bal = bal + bal * i - payment;
    if (bal <= 0) return 0;
  }
  return Math.max(0, bal);
}

/** Years until a loan clears at a fixed payment, capped like the rest of the engine. */
function payoffYears(loan: number, payment: number, ratePct: number, freq: Freq): number {
  const ppy = PERIODS_PER_YEAR[freq];
  const i = ratePct / 100 / ppy;
  if (loan <= 0 || payment <= 0 || payment <= loan * i) return 0; // never clears (or nothing owed)
  let bal = loan;
  let periods = 0;
  const cap = 41 * ppy;
  while (bal > 0 && periods < cap) {
    bal = bal + bal * i - payment;
    periods++;
  }
  return periods / ppy;
}

/* ---------------------------- serviceability ----------------------------- */

/**
 * Rough borrowing capacity from income: monthly surplus after living costs, HECS haircut and
 * other debts, applied at the STRESSED rate (rate + APRA 3% buffer). A lender's real
 * assessment (CBA's) differs - present this as a heuristic, never a quote.
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

/** "$450,000" for the check copy. */
const m = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const pct1 = (n: number) => `${(n * 100).toFixed(1)}%`;

export function eligibility(inp: Inputs, s: Structure): Check[] {
  const cap = incomeCapFor(inp.applicantType);
  const overCap = inp.combinedIncome > cap;
  const typeLabel =
    inp.applicantType === "single" ? "single" : inp.applicantType === "singleParent" ? "single parent" : "joint";
  const checks: Check[] = [];

  const V = s.homeValue;
  const vb = s.valueBase;
  const maxCsp = maxCspShare(inp.homeType);
  const areaLabel = inp.region === "major" ? "a capital city or regional centre" : "the rest of the state";

  const minDeposit = RULES.minDepositShare * V;
  const targetLoan = RULES.maxLvr * vb;                       // the loan size that keeps LMI away
  // the share (as a % of the price) that brings the loan down to 80% of the value
  const shareToFixLoan = Math.max(0, Math.min(maxCsp * V, vb - s.deposit - targetLoan));
  const sharePctToFixLoan = V > 0 ? (shareToFixLoan / V) * 100 : 0;
  // round the suggested share UP so the loan really does land at or under 80%
  const shareFixPct = Math.min(maxCsp * 100, Math.ceil(sharePctToFixLoan * 10) / 10);
  const shareFixDollars = (shareFixPct / 100) * V;
  const depositToFixLoan = Math.max(0, vb - RULES.maxLvr * vb - s.govShare);
  const bankCoversAll = s.govShare <= 0;
  const shareFixFits =
    shareToFixLoan > 0 &&
    sharePctToFixLoan >= CSP.min * 100 - 1e-9 &&
    sharePctToFixLoan <= maxCsp * 100 + 1e-9;

  checks.push({
    id: "income",
    label: `Income cap - ${typeLabel}, ${m(cap)} a year`,
    ok: overCap ? "no" : "yes",
    detail: overCap
      ? `Your ${m(inp.combinedIncome)} is ${m(inp.combinedIncome - cap)} over the ${m(cap)} cap. The test looks only at the taxable income on your last tax notice of assessment: bonuses, overtime and redundancy payouts all count, and there are no exemptions.`
      : `Your ${m(inp.combinedIncome)} is ${m(cap - inp.combinedIncome)} under the ${m(cap)} cap. The scheme reads the taxable income on your last tax notice of assessment, not your salary.`,
    action: overCap
      ? `Two things can change this. A joint application is measured against a combined ${m(165_000)} cap instead, and the cap rises with wages every 1 July. At this income, the scheme isn't available unless one of those applies.`
      : undefined,
  });

  checks.push({
    id: "deposit",
    label: `At least 2% deposit (${m(minDeposit)} on this home)`,
    ok: s.scans.depositOk ? "yes" : "no",
    detail: s.scans.depositOk
      ? `${m(s.deposit)} is ${pct1(s.deposit / Math.max(1, V))} of the price, above the 2% minimum. This money has to be your own cash: stamp duty and setup costs can't come out of it.`
      : `The minimum is 2% of the price, which is ${m(minDeposit)} here. You've entered ${m(s.deposit)}, so the deposit is ${m(minDeposit - s.deposit)} short.`,
    action: s.scans.depositOk
      ? undefined
      : `Add ${m(minDeposit - s.deposit)} to reach ${m(minDeposit)}. Your lender will also ask where the money came from, so keep the paper trail.`,
    fix: s.scans.depositOk ? undefined : { kind: "deposit", value: minDeposit, label: `Model a ${m(minDeposit)} deposit` },
  });

  // LMI gets the longest explanation in the app: it's the cost absolute beginners have never heard of.
  checks.push({
    id: "lvr",
    label: "Loan at 80% of the value or less - no LMI",
    ok: s.scans.lvrOk ? "yes" : "no",
    detail: s.scans.lvrOk
      ? `Your loan is ${pct1(s.lvr)} of the home's value. Banks only charge LMI (Lender's Mortgage Insurance - a one-off fee that protects the bank if you can't pay, not you) once the loan is above 80%. At ${m(s.buyerLoan)} you're clear of it.`
      : `Your loan would be ${m(s.buyerLoan)}, which is ${pct1(s.lvr)} of the ${m(vb)} value. Above 80% (${m(targetLoan)} here) banks usually add LMI (Lender's Mortgage Insurance): a one-off fee that protects the bank if you can't pay, not you. It can run to thousands, and some lenders add it to the loan.`,
    action: s.scans.lvrOk
      ? undefined
      : `Three ways to get the loan to ${m(targetLoan)} or less: ask for a ${shareFixPct.toFixed(1)}% government share (${m(shareFixDollars)}), put in ${m(Math.max(0, depositToFixLoan - s.deposit))} more deposit (total ${m(depositToFixLoan)}), or buy a cheaper home.`,
    fix: s.scans.lvrOk
      ? undefined
      : shareFixFits
        ? { kind: "share", value: shareFixPct, label: `Model a ${shareFixPct.toFixed(1)}% share` }
        : { kind: "deposit", value: depositToFixLoan, label: `Model a ${m(depositToFixLoan)} deposit` },
  });

  checks.push({
    id: "csp",
    label: `Government share between 5% and ${maxCsp * 100}%`,
    ok: s.scans.cspInRange ? "yes" : "check",
    detail: bankCoversAll
      ? `Your deposit alone covers the 20% of value that banks want, so the government would own nothing. There's no gap for it to fill, and this models a normal loan with no LMI.`
      : s.govSharePct > maxCsp + 1e-9 || s.govSharePct < CSP.min - 1e-9
        ? `The share comes out at ${pct1(s.govSharePct)}, outside the scheme's 5% to ${maxCsp * 100}% range.`
        : `The government would own ${pct1(s.govSharePct)} of the home (${m(s.govShare)}). It charges no interest and no rent. When you sell, or buy the share back, it takes that share of the value on the day - so it rises and falls with the market.`,
    action: bankCoversAll
      ? `Nothing to fix. If you'd rather use the scheme - a smaller loan, and no interest on the government's share - set a share yourself in the Government share control.`
      : s.scans.cspInRange
        ? undefined
        : `Set the share back inside 5% to ${maxCsp * 100}%, or switch to Bridge the gap and let the app work it out.`,
    fix: !s.scans.cspInRange && !bankCoversAll && shareFixFits
      ? { kind: "share", value: shareFixPct, label: `Model a ${shareFixPct.toFixed(1)}% share` }
      : undefined,
  });

  checks.push({
    id: "cap",
    label: "Price cap for this area",
    ok: s.scans.cap === null ? "check" : s.scans.capOk ? "yes" : "no",
    detail:
      s.scans.cap === null
        ? "No price cap is listed for that state and area combination. Check the exact suburb and postcode with the official tool before you rely on it."
        : s.scans.capOk
          ? `The cap for ${areaLabel} in ${inp.state} is ${m(s.scans.cap)}, so this price clears it with ${m(s.scans.cap - V)} to spare. The cap is set by the scheme and doesn't rise with house prices.`
          : `This home is ${m(V - s.scans.cap)} over the ${m(s.scans.cap)} cap for ${areaLabel} in ${inp.state}. Caps are fixed, so it won't become eligible later.`,
    action:
      s.scans.cap === null
        ? "Set the state and area again, or use the area checker by postcode further up the page."
        : s.scans.capOk
          ? undefined
          : `Homes up to ${m(s.scans.cap)} work in this area. If the suburb sits on the boundary, the postcode checker shows which side of the line it falls on.`,
    fix:
      s.scans.cap !== null && !s.scans.capOk
        ? { kind: "price", value: s.scans.cap, label: `Model a ${m(s.scans.cap)} home` }
        : undefined,
  });

  checks.push({
    id: "loan",
    label: "A participating lender, principal and interest, 30 years or less",
    ok: "yes",
    detail: `Only lenders on the scheme's panel can make these loans: CommBank, Bank Australia, Teachers Mutual group and Queensland Country Bank. They set the real rate and test your income and spending; this planner assumes ${inp.ratePct}% over ${inp.termYears} years.`,
  });

  return checks;
}

/** Total cash you need at settlement (deposit + duty + selling/buying costs). */
export function upfrontCash(inp: Inputs, s: Structure, dutyEstimate: number | null): number {
  const duty = inp.dutyManual ?? (dutyEstimate ?? 0);
  return s.deposit + duty + inp.otherUpfrontCosts;
}

/** The official Customer Guide example - a sensible neutral starting point. */
export const initialInputs: Inputs = {
  applicantType: "single",
  combinedIncome: 95_000,
  state: "NSW",
  region: "major",
  homeType: "existing",
  homeValue: 800_000,
  valuation0: null,
  deposit: 16_000,
  maxLoan: 544_000,
  govShareMode: "gap",
  customGovSharePct: 30,
  termYears: 30,
  ratePct: 6.55,
  freq: "monthly",
  extraRepayment: 0,
  growthPct: 3,
  incomeGrowthPct: 2.5,
  incAboveCapFromYear: 0,
  buyback: { enabled: false, startYear: 5, percentPerYear: 5, everyYears: 1, loanTermYears: 0, fundByLoan: true },
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
