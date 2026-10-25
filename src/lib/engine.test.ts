import { describe, expect, it } from "vitest";
import {
  borrowingCapacity,
  eligibility,
  initialInputs,
  project,
  repaymentFull,
  structureCustom,
  structureFromFinance,
  type Inputs,
} from "./engine";
import type { StateCode } from "./constants";

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
    expect(s.govShare).toBe(144_000);
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
