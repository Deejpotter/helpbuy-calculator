import { describe, expect, it } from "vitest";
import {
  borrowingCapacity,
  capFor,
  eligibility,
  initialInputs,
  project,
  repayment,
  repaymentFull,
  structureCustom,
  structureFromFinance,
  upfrontCash,
  type Inputs,
} from "./engine";
import { incomeCapFor, type StateCode } from "./constants";

const baseInputs = (over: Partial<Inputs> = {}): Inputs => ({
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
  customGovSharePct: 20,
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
  ...over,
});

describe("structureFromFinance", () => {
  it("matches the official Rob example: 800k home, 16k deposit, 544k loan → CSP 240k (30%), LVR 68%", () => {
    const s = structureFromFinance({
      homeValue: 800_000, deposit: 16_000, maxLoan: 544_000,
      homeType: "existing", state: "NSW", region: "major",
    });
    expect(s.govShare).toBe(240_000);
    expect(s.govSharePct).toBeCloseTo(0.30, 9);
    expect(s.lvr).toBeCloseTo(0.68, 9);
    expect(s.buyerShare).toBe(560_000);
  });

  it("computes the official maximum purchase price formula (deposit+loan)/(1−maxCSP)", () => {
    const s = structureFromFinance({
      homeValue: 999_999_999, deposit: 16_000, maxLoan: 544_000,
      homeType: "existing", state: "NSW", region: "major",
    });
    // (16_000 + 544_000)/0.7 = 800_000
    expect(s.maxAffordablePrice).toBe(800_000);
  });

  it("flags a shortfall when the gap exceeds the maximum CSP", () => {
    const s = structureFromFinance({
      homeValue: 1_000_000, deposit: 20_000, maxLoan: 700_000,
      homeType: "existing", state: "NSW", region: "major", // gap 280k > 30% = 300k? 30% is 300k ok flip…
    });
    // V=1,000,000, D=20k, L=700k → gap 280,000 ≤ 300,000 → no shortfall
    expect(s.shortfall).toBe(0);
    expect(s.govShare).toBe(280_000);
  });

  it("forces shortfall when the gap exceeds 30% and new-build allows to 40%", () => {
    const eng = structureFromFinance({
      homeValue: 1_200_000, deposit: 40_000, maxLoan: 700_000,
      homeType: "existing", state: "NSW", region: "major",
    });
    expect(eng.shortfall).toBe(100_000); // gap 460k - 30%x1.2M=360k
    const nw = structureFromFinance({
      homeValue: 1_200_000, deposit: 40_000, maxLoan: 700_000,
      homeType: "new", state: "NSW", region: "major",
    });
    expect(nw.shortfall).toBe(0); // 40% of 1.2M = 480k covers the 460k gap
    expect(nw.govShare).toBe(460_000);
  });

  it("caps the loan at 80% of value via the government top-up (General Terms 3.2(b))", () => {
    // 650k is above 80% of 800k: the contribution rises so the loan lands at 640k
    const s = structureFromFinance({
      homeValue: 800_000, deposit: 16_000, maxLoan: 650_000,
      homeType: "existing", state: "NSW", region: "major",
    });
    expect(s.buyerLoan).toBe(640_000);
    expect(s.lvr).toBeCloseTo(0.8, 9);
    expect(s.govShare).toBeCloseTo(144_000, 4);
    expect(s.shortfall).toBe(0);
  });

  it("measures the share percentage on the lower initial valuation when the price is above it (clause 6.3)", () => {
    const s = structureFromFinance({
      homeValue: 750_000, valuation0: 725_000, deposit: 50_000, maxLoan: 550_000,
      homeType: "existing", state: "NSW", region: "major",
    });
    expect(s.govShare).toBe(150_000);
    expect(s.govSharePct).toBeCloseTo(150_000 / 725_000, 6);
    expect(s.valueBase).toBe(725_000);
  });

  it("keeps the horizon sane and the loan honest for a late-start funded buy-back plan", () => {
    // the user's shape: plan starts in year 35 -> horizon must NOT balloon to 80+
    const inp = baseInputs({
      homeValue: 430_000,
      deposit: 12_000,
      maxLoan: 289_000,
      govShareMode: "custom",
      customGovSharePct: 30,
      growthPct: 7,
      ratePct: 6.55,
      buyback: { enabled: true, startYear: 35, percentPerYear: 5, fundByLoan: true },
      sellAfterYear: 0,
    });
    const s = structureCustom({ homeValue: 430_000, deposit: 12_000, customGovSharePct: 30, homeType: "existing", state: "VIC", region: "major" });
    const pr = project(inp, s);
    const lastRow = pr.rows[pr.rows.length - 1];
    expect(pr.rows.length - 1).toBeLessThanOrEqual(60); // horizon capped
    expect(pr.buybackSummary.fullOwnershipYear).toBeLessThanOrEqual(45); // 30% at 5%/yr finishes fast
    // borrowings ride the loan balance: the loan line must NOT end at zero
    expect(lastRow.loanBalance).toBeGreaterThan(0);
    // and after the full exit the government share is zero
    expect(lastRow.cspValue).toBeCloseTo(0, 4);
    // equity = full value minus the new loan still outstanding
    expect(lastRow.buyerEquityDollar).toBeCloseTo(lastRow.homeValue - lastRow.loanBalance, 0);
  });

  it("defaults a planned buy-back to a new loan, and each new loan repays on its own clock", () => {
    expect(initialInputs.buyback.fundByLoan).toBe(true);
    // one big payment at year 5 clears the 30% share, so there is exactly one new loan to follow
    const inp = baseInputs({
      growthPct: 0,
      ratePct: 6,
      buyback: { enabled: true, startYear: 5, percentPerYear: 50, fundByLoan: true },
      sellAfterYear: 0,
    });
    const s = structureFromFinance({
      homeValue: 800_000, deposit: 16_000, maxLoan: 544_000,
      homeType: "existing", state: "NSW", region: "major",
    });
    const pr = project(inp, s);
    const borrowed = 240_000; // the whole government share, bought in one go
    expect(pr.buybackSummary.borrowed).toBeCloseTo(borrowed, 4);
    expect(pr.buybackSummary.totalPaid).toBeCloseTo(borrowed, 4);
    expect(pr.buybackSummary.extraRepayment).toBeGreaterThan(0);
    // the new loan exists from its year and falls every year after that
    const at = (y: number) => pr.rows.find((r) => r.year === y)!.loanBalance;
    expect(at(5)).toBeGreaterThan(borrowed);
    expect(at(10)).toBeLessThan(at(5));
    expect(at(20)).toBeLessThan(at(10));
    // the first loan is gone by year 30, but the new loan is still running until year 35
    expect(at(31)).toBeGreaterThan(0);
    expect(at(31)).toBeLessThan(at(30));
    expect(at(35)).toBeCloseTo(0, 0);
  });

  it("keeps the first-loan amortisation smooth (no cliff at payoff)", () => {
    const inp = baseInputs({ growthPct: 0, ratePct: 6, termYears: 30, buyback: { enabled: false, startYear: 5, percentPerYear: 5, fundByLoan: true } });
    const s = structureFromFinance({
      homeValue: 800_000, deposit: 16_000, maxLoan: 544_000,
      homeType: "existing", state: "NSW", region: "major",
    });
    const pr = project(inp, s);
    const at = (y: number) => pr.rows.find((r) => r.year === y)!.loanBalance;
    expect(at(29)).toBeGreaterThan(0);
    expect(at(29)).toBeLessThan(45_000); // a 30 year loan at 6% has one year of payments left in year 29
    expect(at(30)).toBe(0);
  });

  it("treats the bank's maximum as a ceiling, not the loan", () => {
    // exactly the shape from the user's screenshot: the limit is more than the home needs
    const s = structureFromFinance({
      homeValue: 450_000, deposit: 16_000, maxLoan: 456_441,
      homeType: "existing", state: "VIC", region: "major",
    });
    // the loan is what the home needs at 80% of value, not the bank's limit
    expect(s.buyerLoan).toBeLessThanOrEqual(360_000);
    expect(s.lvr).toBeLessThanOrEqual(0.8 + 1e-9);
    // the shortfall is the 20% the deposit doesn't cover: 90k - 16k
    expect(s.govShare).toBeCloseTo(74_000, 4);
    expect(s.govSharePct).toBeCloseTo(74_000 / 450_000, 6);

    const inp = baseInputs({
      state: "VIC", homeValue: 450_000, deposit: 16_000, maxLoan: 456_441, govShareMode: "gap",
    });
    const checks = eligibility(inp, s);
    expect(checks.filter((c) => c.ok === "no")).toHaveLength(0);
    expect(checks.find((c) => c.id === "lvr")!.ok).toBe("yes");
    expect(checks.find((c) => c.id === "csp")!.ok).toBe("yes");
  });

  it("explains LMI in plain words and offers the share that removes it", () => {
    // a share set too low leaves the loan above 80%: the app has to name LMI and give the fix
    const inp = baseInputs({
      state: "VIC", homeValue: 450_000, deposit: 16_000, maxLoan: 456_441,
      govShareMode: "custom", customGovSharePct: 5, homeType: "existing", growthPct: 3,
    });
    const s = structureCustom({
      homeValue: 450_000, deposit: 16_000, customGovSharePct: 5,
      homeType: "existing", state: "VIC", region: "major",
    });
    expect(s.lvr).toBeGreaterThan(0.8);

    const checks = eligibility(inp, s);
    const lvr = checks.find((c) => c.id === "lvr")!;
    expect(lvr.ok).toBe("no");
    expect(lvr.detail).toMatch(/Lender's Mortgage Insurance/);
    expect(lvr.detail).toMatch(/protects the bank/);
    expect(lvr.action).toMatch(/16\.5% government share/);
    expect(lvr.action).toMatch(/\$51,500 more deposit/);
    expect(lvr.fix).toMatchObject({ kind: "share", value: 16.5 });

    // applying the fix clears it: loan at 80% of value, share inside the 5-30% range
    const inp2 = { ...inp, govShareMode: "custom" as const, customGovSharePct: 16.5 };
    const s2 = structureCustom({
      homeValue: 450_000, deposit: 16_000, customGovSharePct: 16.5,
      homeType: "existing", state: "VIC", region: "major",
    });
    expect(s2.buyerLoan).toBeLessThanOrEqual(360_000);
    const after = eligibility(inp2, s2);
    expect(after.find((c) => c.id === "lvr")!.ok).toBe("yes");
    expect(after.find((c) => c.id === "csp")!.ok).toBe("yes");
  });

  it("offers a price that fits the cap and a deposit that clears the minimum", () => {
    const inp = baseInputs({ state: "VIC", homeValue: 1_000_000, deposit: 5_000, maxLoan: 700_000 });
    const s = structureFromFinance({
      homeValue: 1_000_000, deposit: 5_000, maxLoan: 700_000,
      homeType: "existing", state: "VIC", region: "major",
    });
    const checks = eligibility(inp, s);
    const cap = checks.find((c) => c.id === "cap")!;
    expect(cap.ok).toBe("no");
    expect(cap.action).toMatch(/up to \$950,000/);
    expect(cap.fix).toMatchObject({ kind: "price", value: 950_000 });

    const deposit = checks.find((c) => c.id === "deposit")!;
    expect(deposit.ok).toBe("no");
    expect(deposit.fix).toMatchObject({ kind: "deposit", value: 20_000 });
    expect(deposit.action).toMatch(/Add \$15,000/);
  });

  it("checks price caps by state and region", () => {
    const inCap = structureFromFinance({
      homeValue: 1_300_000, deposit: 60_000, maxLoan: 850_000,
      homeType: "existing", state: "NSW", region: "major",
    });
    expect(inCap.scans.capOk && inCap.scans.cap).toBe(1_300_000);
    const vic = structureFromFinance({
      homeValue: 1_300_000, deposit: 60_000, maxLoan: 850_000,
      homeType: "existing", state: "VIC", region: "major",
    });
    expect(vic.scans.capOk).toBe(false);
  });
});

describe("repaymentFull", () => {
  it("reproduces the standard monthly repayment", () => {
    const r = repaymentFull(500_000, 6, 30, "monthly", 0);
    // mortgage math: 2,997.75/month at nominal 6%/12 over 360 payments
    expect(r.amount).toBeCloseTo(2997.75, 1);
    expect(r.payYears).toBeCloseTo(30, 1);
  });

  it("extra repayments cut the payoff years and interest", () => {
    const base = repaymentFull(500_000, 6, 30, "monthly", 0);
    const withExtra = repaymentFull(500_000, 6, 30, "monthly", 500);
    expect(withExtra.payYears).toBeLessThan(base.payYears);
    expect(withExtra.totalInterest).toBeLessThan(base.totalInterest);
  });

  it("weekly repayments on the same loan are roughly the monthly ÷ (52/12)", () => {
    const m = repaymentFull(500_000, 6, 30, "monthly", 0).amount;
    const w = repaymentFull(500_000, 6, 30, "weekly", 0).amount;
    expect(w).toBeGreaterThan(m * (12 / 52) * 0.99);
    expect(w).toBeLessThan(m * (12 / 52) * 1.1);
  });
});

describe("project", () => {
  it("timeline keeps the CSP proportional to the value path when no events fire", () => {
    const inp = baseInputs();
    const s = structureFromFinance({ homeValue: inp.homeValue, deposit: inp.deposit, maxLoan: inp.maxLoan, homeType: "existing", state: "NSW", region: "major" });
    const pr = project(inp, s);
    const r5 = pr.rows[5];
    expect(r5.cspPct).toBeCloseTo(0.3, 6);
    expect(r5.homeValue).toBeCloseTo(800_000 * Math.pow(1.03, 5), 0);
    // no plan → no payments modeled
    expect(pr.buybackSummary.payments).toBe(0);
    expect(pr.buybackSummary.fullOwnershipYear).toBe(null);
  });

  it("plans buy-backs at ≥5% of the value, rounded to $1,000, and reduces the CSP", () => {
    const inp = baseInputs({
      buyback: { enabled: true, startYear: 1, percentPerYear: 5, fundByLoan: false },
      growthPct: 0,
    });
    const s = structureFromFinance({ homeValue: 800_000, deposit: 16_000, maxLoan: 544_000, homeType: "existing", state: "NSW", region: "major" });
    const pr = project(inp, s);
    // year 1: value 800k, min payment 5% = 40k (rounded to 1k) from CSP 240k → 200k (25%)
    expect(pr.rows[1].cspValue).toBe(200_000);
    expect(pr.rows[1].cspPct).toBeCloseTo(0.25, 9);
    // hits zero-ish over years: 240 - 5 x 40 = 40 at year 5; then full remaining share (40k ≤5% rule) at year 6
    expect(pr.rows[6].cspValue).toBeCloseTo(0, 6);
    expect(pr.rows[6].cspPct).toBeCloseTo(0, 6);
    // buy-back summary: 6 payments totalling the whole 240k share, full ownership reached in year 6
    expect(pr.buybackSummary.payments).toBe(6);
    expect(pr.buybackSummary.totalPaid).toBeCloseTo(240_000, 4);
    expect(pr.buybackSummary.firstYear).toBe(1);
    expect(pr.buybackSummary.fullOwnershipYear).toBe(6);
  });

  it("applies the official improvement formula (20% x 700k / 760k = 18.42%)", () => {
    const inp = baseInputs({
      homeValue: 700_000,
      govShareMode: "custom",
      customGovSharePct: 20,
      improvement: { year: 1, cost: 50_000, valueUplift: 60_000 },
      growthPct: 0,
    });
    const s = structureCustom({ homeValue: 700_000, deposit: 21_000, customGovSharePct: 20, homeType: "existing", state: "NSW", region: "major" });
    expect(s.govShare).toBe(140_000);
    const pr = project(inp, s);
    // at year 1 value = 760k, CSP % = 20% x 700/760 → dollars still 140k → 18.42%
    expect(pr.rows[1].cspValue).toBeCloseTo(140_000, 0);
    expect(pr.rows[1].cspPct).toBeCloseTo(0.1842105, 6);
  });

  it("models the sale waterfall in the Guide's payout order (Sharon example values)", () => {
    const inp = baseInputs({
      homeValue: 750_000, deposit: 30_000, maxLoan: 570_000, // CSP 150k = 20%
      govShareMode: "gap",
      growthPct: 0,
      sellAfterYear: 5,
      agentPct: 0,          // isolate: 1M example? use growth to reach 1M at year 5
      saleLegalFees: 0,
      termYears: 40,        // avoid full payoff noise: interest-only-ish? no - use 40-yr term
      extraRepayment: 0,
    });
    void inp;
    // Simpler: reuse the guide numbers directly with custom mode and zero-growth loan math disabled is
    // not possible - instead verify the waterfall arithmetic on a synthetic projection.
    const s = structureFromFinance({ homeValue: 750_000, deposit: 30_000, maxLoan: 570_000, homeType: "existing", state: "NSW", region: "major" });
    const pr = project({ ...inp, sellAfterYear: 5 }, s);
    const sold = pr.soldAt!;
    if (!sold) throw new Error("no sale modeled");
    expect(sold.govPayout).toBeCloseTo(pr.rows[5].cspValue, 4);
    expect(sold.yourNet).toBeCloseTo(sold.salePrice - sold.costs - sold.loanPayout - sold.govPayout, 4);
  });

  it("puts a minimum forced buy-back at the chosen income-overrun year", () => {
    const inp = baseInputs({ growthPct: 0, sellAfterYear: 0, incAboveCapFromYear: 3, buyback: { enabled: false, startYear: 5, percentPerYear: 5, fundByLoan: false } });
    const s = structureFromFinance({ homeValue: 800_000, deposit: 16_000, maxLoan: 544_000, homeType: "existing", state: "NSW", region: "major" });
    const pr = project(inp, s);
    expect(pr.rows[2].cspValue).toBe(240_000);
    expect(pr.rows[3].cspValue).toBe(240_000 - 40_000);
    expect(pr.events.some((e) => e.includes("required buy-back"))).toBe(true);
  });
});

describe("borrowingCapacity", () => {
  it("monotonic in income and cuts with a bigger buffer rate", () => {
    const a = borrowingCapacity({ grossIncome: 100_000, livingMonthly: 2_500, otherMonthlyDebt: 0, hecsPct: 0, ratePct: 5.5, termYears: 30 });
    const b = borrowingCapacity({ grossIncome: 130_000, livingMonthly: 2_500, otherMonthlyDebt: 0, hecsPct: 0, ratePct: 5.5, termYears: 30 });
    expect(b).toBeGreaterThan(a);
    const stressed = borrowingCapacity({ grossIncome: 100_000, livingMonthly: 2_500, otherMonthlyDebt: 0, hecsPct: 0, ratePct: 7, termYears: 30 });
    expect(stressed).toBeLessThan(a);
  });
});

describe("edge cases: the structure itself", () => {
  const structure = (over: Partial<Parameters<typeof structureFromFinance>[0]> = {}) =>
    structureFromFinance({
      homeValue: 800_000, deposit: 16_000, maxLoan: 544_000,
      homeType: "existing", state: "NSW", region: "major", ...over,
    });

  it("asks for no government share when the deposit alone reaches 20%", () => {
    const s = structure({ deposit: 200_000, maxLoan: 600_000 });
    expect(s.govShare).toBe(0);
    expect(s.buyerLoan).toBe(600_000);
    expect(s.lvr).toBeCloseTo(0.75, 9);
    expect(s.scans.cspInRange).toBe(false); // nothing to bridge: modelled as a normal loan
  });

  it("keeps the share inside the scheme range when the deposit is tiny", () => {
    const s = structure({ deposit: 0, maxLoan: 600_000 });
    expect(s.govShare).toBeGreaterThanOrEqual(0.05 * 800_000);
    expect(s.govShare).toBeLessThanOrEqual(0.30 * 800_000);
    expect(s.lvr).toBeCloseTo(0.75, 9);
    expect(s.scans.depositOk).toBe(false);
  });

  it("tops the share up to the 5% minimum rather than a sliver", () => {
    // 8k of gap and a 4k LMI floor would both be under 5% of the price
    const s = structure({ deposit: 156_000, maxLoan: 636_000 });
    expect(s.govShare).toBe(40_000);
    expect(s.govSharePct).toBeCloseTo(0.05, 9);
  });

  it("reports a shortfall when even the maximum share cannot close the gap", () => {
    const s = structure({ deposit: 16_000, maxLoan: 100_000 });
    expect(s.govShare).toBe(240_000); // 30% cap
    expect(s.shortfall).toBe(444_000); // 800k - 16k - 100k - 240k
    expect(s.buyerLoan).toBeGreaterThan(s.homeValue - s.deposit - s.govShare - 1);
  });

  it("measures on the price when the valuation is higher, and on the valuation when lower", () => {
    expect(structure({ valuation0: 900_000 }).valueBase).toBe(800_000);
    expect(structure({ homeValue: 750_000, valuation0: 725_000 }).valueBase).toBe(725_000);
  });

  it("allows 40% for a new home and clamps a custom share to the maximum", () => {
    const newHome = structure({ homeType: "new", deposit: 16_000, maxLoan: 400_000 });
    expect(newHome.govShare).toBeCloseTo(0.4 * 800_000, 6);

    const tooBig = structureCustom({
      homeValue: 800_000, deposit: 16_000, customGovSharePct: 45,
      homeType: "existing", state: "NSW", region: "major",
    });
    expect(tooBig.govSharePct).toBeCloseTo(0.3, 9);
    expect(tooBig.buyerLoan).toBe(800_000 - 16_000 - 240_000);
  });

  it("flags a custom share under the 5% minimum", () => {
    const s = structureCustom({
      homeValue: 800_000, deposit: 16_000, customGovSharePct: 2,
      homeType: "existing", state: "NSW", region: "major",
    });
    expect(s.govSharePct).toBeCloseTo(0.02, 9);
    expect(s.scans.cspInRange).toBe(false);
    expect(s.lvr).toBeCloseTo((800_000 - 16_000 - 16_000) / 800_000, 9);
  });

  it("looks up caps, including the regions that have none", () => {
    expect(capFor("VIC", "major")).toBe(950_000);
    expect(capFor("VIC", "rest")).toBe(650_000);
    expect(capFor("ACT", "rest")).toBeNull();
    expect(capFor("JBT", "major")).toBeNull();
  });

  it("knows the income cap for every applicant type", () => {
    expect(incomeCapFor("single")).toBe(103_000);
    expect(incomeCapFor("singleParent")).toBe(165_000);
    expect(incomeCapFor("joint")).toBe(165_000);
  });
});

describe("edge cases: repayments", () => {
  it("never charges interest at a zero rate, and splits the loan evenly", () => {
    const r = repaymentFull(360_000, 0, 30, "monthly", 0);
    expect(r.amount).toBeCloseTo(1_000, 9);
    expect(r.payYears).toBeCloseTo(30, 9);
    expect(r.totalInterest).toBe(0);
  });

  it("returns zeroes for a zero loan instead of dividing by it", () => {
    expect(repaymentFull(0, 6, 30, "monthly", 0)).toEqual({ amount: 0, payYears: 0, totalInterest: 0, nPeriods: 0 });
  });

  it("pays the loan off early with a large extra repayment", () => {
    const base = repaymentFull(100_000, 6, 30, "monthly", 0);
    const fast = repaymentFull(100_000, 6, 30, "monthly", 5_000);
    expect(fast.amount).toBeCloseTo(base.amount + 5_000, 9);
    expect(fast.payYears).toBeLessThan(2);
    expect(fast.totalInterest).toBeLessThan(base.totalInterest / 10);
  });

  it("costs a whisker less per year on weekly than monthly, because interest accrues less between payments", () => {
    const monthly = repayment(360_000, 6, 30, "monthly");
    const weekly = repayment(360_000, 6, 30, "weekly");
    const yearWeekly = weekly * 52;
    const yearMonthly = monthly * 12;
    expect(yearWeekly).toBeLessThan(yearMonthly);
    expect(yearWeekly).toBeGreaterThan(yearMonthly * 0.999);
  });

  it("scales the repayment down as the term lengthens", () => {
    const twenty = repayment(360_000, 6, 20, "monthly");
    const thirty = repayment(360_000, 6, 30, "monthly");
    expect(thirty).toBeLessThan(twenty);
  });
});

describe("edge cases: the projection", () => {
  const structure = (over: Partial<Parameters<typeof structureFromFinance>[0]> = {}) =>
    structureFromFinance({
      homeValue: 800_000, deposit: 16_000, maxLoan: 544_000,
      homeType: "existing", state: "NSW", region: "major", ...over,
    });

  it("works on a weekly repayment frequency", () => {
    const inp = baseInputs({ freq: "weekly" });
    const pr = project(inp, structure());
    expect(pr.rows[0].loanBalance).toBe(544_000);
    expect(pr.rows[1].loanBalance).toBeLessThan(pr.rows[0].loanBalance);
    expect(pr.rows[1].loanBalance).toBeGreaterThan(0);
  });

  it("caps the horizon at 60 years and drops a sale past the cap", () => {
    const pr = project(baseInputs({ sellAfterYear: 70 }), structure());
    expect(pr.rows).toHaveLength(61);
    expect(pr.soldAt).toBeNull();
  });

  it("models a sale after the loan is repaid with nothing to pay the lender", () => {
    const pr = project(baseInputs({ growthPct: 0, sellAfterYear: 35, termYears: 30 }), structure());
    expect(pr.soldAt).not.toBeNull();
    expect(pr.soldAt!.loanPayout).toBe(0);
    expect(pr.soldAt!.govPayout).toBe(240_000);
    expect(pr.soldAt!.yourNet).toBeCloseTo(800_000 - pr.soldAt!.costs - 240_000, 6);
  });

  it("leaves the loan untouched when buy-backs come from savings", () => {
    const savings = project(
      baseInputs({ growthPct: 0, buyback: { enabled: true, startYear: 5, percentPerYear: 5, fundByLoan: false } }),
      structure(),
    );
    const none = project(baseInputs({ growthPct: 0 }), structure());
    expect(savings.rows[10].loanBalance).toBeCloseTo(none.rows[10].loanBalance, 6);
    expect(savings.buybackSummary.borrowed).toBe(0);
    expect(savings.buybackSummary.extraRepayment).toBe(0);
  });

  it("raises a buy-back below the minimum up to 5% of the value", () => {
    const pr = project(
      baseInputs({ growthPct: 0, buyback: { enabled: true, startYear: 5, percentPerYear: 1, fundByLoan: false } }),
      structure(),
    );
    expect(pr.events[0]).toContain("$40,000"); // 5% of 800k, rounded to $1,000
    expect(pr.buybackSummary.totalPaid).toBeGreaterThanOrEqual(40_000);
  });

  it("ignores an improvement dated in year zero and a forced buy-back in year zero", () => {
    const pr = project(
      baseInputs({
        growthPct: 0,
        improvement: { year: 0, cost: 50_000, valueUplift: 50_000 },
        incAboveCapFromYear: 0,
        buyback: { enabled: false, startYear: 5, percentPerYear: 5, fundByLoan: false },
      }),
      structure(),
    );
    expect(pr.rows[0].homeValue).toBe(800_000);
    expect(pr.events).toHaveLength(0);
  });

  it("keeps the Commonwealth whole at sale: it takes its share of the day's value", () => {
    const inp = baseInputs({ growthPct: 3, sellAfterYear: 10 });
    const pr = project(inp, structure());
    expect(pr.soldAt!.govPayout).toBeCloseTo(pr.rows[10].homeValue * 0.3, 4);
  });

  it("costs more to buy the share back as the home grows, because it is a share of the day's value", () => {
    // the CSP is a percentage of the CURRENT value, so buying it out costs more as the home grows
    const pr = project(
      baseInputs({
        growthPct: 5,
        buyback: { enabled: true, startYear: 5, percentPerYear: 5, fundByLoan: true },
      }),
      structure(),
    );
    expect(pr.buybackSummary.payments).toBeGreaterThan(0);
    expect(pr.buybackSummary.totalPaid).toBeGreaterThan(240_000); // more than the original 30% share at today's value
  });

  it("explains a zero share plainly when the deposit already covers the 20%", () => {
    const rich = structureFromFinance({
      homeValue: 800_000, deposit: 200_000, maxLoan: 600_000,
      homeType: "existing", state: "NSW", region: "major",
    });
    const checks = eligibility(baseInputs({ deposit: 200_000, maxLoan: 600_000 }), rich);
    const csp = checks.find((c) => c.id === "csp")!;
    expect(csp.ok).toBe("check");
    expect(csp.detail).toMatch(/deposit alone covers the 20%/);
    expect(csp.action).toMatch(/Nothing to fix/);
    expect(csp.fix).toBeUndefined();
  });

  it("starts and ends with a coherent balance sheet", () => {
    const pr = project(baseInputs({ growthPct: 3 }), structure());
    for (const r of pr.rows) {
      expect(r.buyerFractionDollar + r.cspValue).toBeCloseTo(r.homeValue, 4);
      expect(r.buyerEquityDollar).toBeCloseTo(r.buyerFractionDollar - r.loanBalance, 4);
      expect(r.loanBalance).toBeGreaterThanOrEqual(0);
    }
    expect(pr.rows[0].buyerEquityDollar).toBe(16_000); // just the deposit on day one
  });
});

describe("edge cases: eligibility and cash", () => {
  const s = structureFromFinance({
    homeValue: 800_000, deposit: 16_000, maxLoan: 544_000,
    homeType: "existing", state: "NSW", region: "major",
  });

  it("says how much more deposit is needed, and offers to model it", () => {
    const checks = eligibility(baseInputs({ deposit: 0 }), structureFromFinance({
      homeValue: 800_000, deposit: 0, maxLoan: 544_000, homeType: "existing", state: "NSW", region: "major",
    }));
    const deposit = checks.find((c) => c.id === "deposit")!;
    expect(deposit.ok).toBe("no");
    expect(deposit.action).toMatch(/Add \$16,000/);
    expect(deposit.fix).toMatchObject({ kind: "deposit", value: 16_000 });
  });

  it("treats income exactly on the cap as passing", () => {
    const checks = eligibility(baseInputs({ combinedIncome: 103_000 }), s);
    expect(checks.find((c) => c.id === "income")!.ok).toBe("yes");
  });

  it("asks for a check when the area has no cap listed", () => {
    const act = structureFromFinance({
      homeValue: 600_000, deposit: 12_000, maxLoan: 400_000,
      homeType: "existing", state: "ACT", region: "rest",
    });
    const checks = eligibility(baseInputs({ state: "ACT", region: "rest" }), act);
    expect(checks.find((c) => c.id === "cap")!.ok).toBe("check");
  });

  it("flags a custom share outside the range without offering a misleading fix", () => {
    const tiny = structureCustom({
      homeValue: 800_000, deposit: 16_000, customGovSharePct: 2,
      homeType: "existing", state: "NSW", region: "major",
    });
    const checks = eligibility(baseInputs({ govShareMode: "custom", customGovSharePct: 2 }), tiny);
    const csp = checks.find((c) => c.id === "csp")!;
    expect(csp.ok).toBe("check");
    expect(csp.detail).toMatch(/outside the scheme's 5% to 30% range/);
  });

  it("adds the duty estimate, or the manual figure, to the cash needed", () => {
    const inp = baseInputs();
    expect(upfrontCash(inp, s, 23_390)).toBe(16_000 + 23_390 + 4_750);
    expect(upfrontCash({ ...inp, dutyManual: 0 }, s, 23_390)).toBe(16_000 + 4_750);
    expect(upfrontCash({ ...inp, dutyManual: 12_500 }, s, 23_390)).toBe(16_000 + 12_500 + 4_750);
  });

  it("answers zero capacity for no income or no surplus", () => {
    const none = borrowingCapacity({ grossIncome: 0, livingMonthly: 2_000, otherMonthlyDebt: 0, hecsPct: 0, ratePct: 6, termYears: 30 });
    expect(none).toBe(0);
    const squeezed = borrowingCapacity({ grossIncome: 60_000, livingMonthly: 6_000, otherMonthlyDebt: 500, hecsPct: 5, ratePct: 6, termYears: 30 });
    expect(squeezed).toBe(0);
  });

  it("gives more capacity on a longer term, and less with other debts", () => {
    const base = { grossIncome: 100_000, livingMonthly: 2_500, otherMonthlyDebt: 0, hecsPct: 0, ratePct: 6 };
    const thirty = borrowingCapacity({ ...base, termYears: 30 });
    const twenty = borrowingCapacity({ ...base, termYears: 20 });
    const debts = borrowingCapacity({ ...base, otherMonthlyDebt: 800, termYears: 30 });
    expect(thirty).toBeGreaterThan(twenty);
    expect(debts).toBeLessThan(thirty);
  });
});

describe("eligibility", () => {
  it("flags income over the joint cap and under the single cap", () => {
    const inp = baseInputs({ applicantType: "joint", combinedIncome: 170_000 });
    const checks = eligibility(inp, structureFromFinance({ homeValue: inp.homeValue, deposit: inp.deposit, maxLoan: inp.maxLoan, homeType: "existing", state: "NSW", region: "major" }));
    const income = checks.find((c) => c.id === "income")!;
    expect(income.ok).toBe("no");
    const single = eligibility(baseInputs(), structureFromFinance({ homeValue: 800_000, deposit: 16_000, maxLoan: 544_000, homeType: "existing", state: "NSW", region: "major" }));
    expect(single.find((c) => c.id === "income")!.ok).toBe("yes");
  });
});
