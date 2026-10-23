# How every number is computed

The engine lives in `src/lib/engine.ts` (pure TypeScript, no React) and is covered by unit
tests in `src/lib/engine.test.ts`, which use the official documents' own worked examples as
fixtures. This page walks through each model and names the source clause or page.

## 1. The purchase structure

Inputs: purchase price `P`, initial valuation `V0` (optional, defaults to the price), deposit
`D`, maximum bank loan `L`, home type (existing or new).

- **Value base.** `valueBase = min(P, V0)`. Per clause 6.3 of the General Terms, the initial
  Commonwealth Share Percentage is measured on the lesser of purchase price and valuation, so
  paying above the valuation raises the government's percentage.
- **Contribution (clause 6.1).** `CC = max(0, min(MaxCC, P - L - D))` where `MaxCC` is 30
  percent of price for an existing home and 40 percent for new. If `CC <= 0` you cannot join
  the scheme (the app shows the gap test as a review chip: the lender's capacity test would
  likely rule you out since you can already afford it).
- **Top-up (clause 3.2(b)).** If that structure would leave the loan above 80 percent of value,
  the contribution increases (still within the maximum) so the loan lands at 80 percent or
  less: `CC = max(CC, 0.2P - D)`. Your loan can end up smaller than the bank's maximum.
- **Derived.** `govShareDollars = CC`, `govSharePct = CC / valueBase`,
  `buyerLoan = P - D - govShareDollars` capped by the bank maximum and the 80 percent rule,
  `lvr = buyerLoan / valueBase`.
- **Shortfall.** If the maximum contribution cannot cover the gap
  (`P - D - L - MaxCC > 0`), the app says so and prints the official maximum purchase price
  at your capacity: `maxPrice = (D + L) / (1 - MaxCC)`, which is exactly the official Maximum
  Purchase Price calculator's formula.

Worked check against the Customer Guide: $800,000 price, $16,000 deposit, $544,000 loan gives
a $240,000 share (30 percent) at a 68 percent loan-to-value. The default inputs reproduce this.

## 2. Repayments on the buyer's share

- Frequency `w` in periods per year: 12 monthly, 26 fortnightly, 52 weekly.
- Period rate uses the bank convention: `i = rate / w` (nominal annual over periods).
- Base repayment: `A = L(i) / (1 - (1 + i)^-n)` with `n = termYears * w`, plus any extra per
  period. This reproduces the standard result: $500,000 at 6 percent over 30 years is $2,997.75
  per month (tested).
- Payoff years and lifetime interest come from a period-by-period simulation, capped at 41
  years of periods.
- The stressed row applies the APRA buffer: rate plus 3 percentage points, same term.
- There is no interest and no rent on the government share (Customer Guide, Fact Sheet).

## 3. Eligibility checks

Each check in results section 02 maps to a rule:

1. Income cap: applicant type against the FY 2026-27 thresholds ($103,000 single; $165,000
   single parent and joint), assessed on the prior year Notice of Assessment; no exemptions
   (Customer Guide income section; FAQ).
2. Deposit: at least 2 percent of price (GT clause 2.1(f)(ii)(B)), and expected to contribute
   the maximum you reasonably can.
3. Loan at 80 percent or less, so LMI does not apply at purchase (GT 2.1(f); CBA page: deposit
   plus share at least 20 percent).
4. Government share within 5 to 30 percent existing or 5 to 40 percent new (GT 3.2, 3.3).
5. Price cap for state and region (Fact Sheet table; caps are policy set, not indexed).
6. Gap test: if you can already buy without help, the lender's capacity test may rule you out
   (GT 6.1; Customer Guide financial capacity test).
7. Loan requirements: P and I up to 30 years, interest-only only during construction (CBA page).

## 4. The projection (anniversaries, up to 40+ years)

- **Value path.** Growth is your assumption: `value(t) = valueBase * (1 + g)^t`. If you model
  an improvement in year `k` with estimated uplift `U`, the path becomes
  `(prev + U) * (1 + g)^(t - k)` from year `k` (a works-based valuation, per the Home
  Improvement Guide).
- **Buy-backs.** Each payment pays down the government share. Per GT 8.2 and the Repayment
  Guide, a payment must reduce the share by at least 5 percentage points of the value at that
  time (rounded to $1,000) unless it is the final full buy-out; the plan's percent is clamped
  to that minimum, and once the remaining share sits at or under 5 percent, the full remaining
  amount is repaid. Savings-funded payments leave the loan alone; loan-funded ones add the
  payment to your balance (the app warns that this can bring LMI back if the loan then exceeds
  80 percent of value, per the TMD).
- **Improvement adjustment (GT 6.6, Customer Guide example).** `share% post = share% pre *
  valuePre / valuePost`, so the kept dollar value of the government share stays constant and
  the uplift is all yours. Tested with the Simon and Ken example: 20 percent of $700,000 with
  $60,000 of uplift to $760,000 gives 18.42 percent.
- **Forced buy-back (optional).** If you set the year your income exceeds the cap, the app adds
  one minimum payment there (5 percent of that year's value), reflecting GT 13.6: Housing
  Australia considers whether you have capacity for at least a 5 percent repayment, and only
  then requires it.
- **Loans and shares are tracked separately.** Your equity = buyer share of value minus loan
  balance (including any buy-back borrowing).

## 5. Selling

GT 7.1: the Commonwealth Share Amount is `share% x greater(valuation, sale price)` at exit. The
waterfall (GT 9.1 and the Customer Guide) is: selling costs; lender principal and accrued
interest; Housing Australia's share; any remaining lender balance; then you. The app applies
selling costs as `agent% + legal fees`, and at each horizon year in 5, 10, 15, 20 and 30.

Tested against the Guide's Sharon example: bought $750,000 with a 20 percent share; selling at
$1,000,000 pays the government $200,000; the remainder after costs and loan payout is yours.

## 6. Rough borrowing capacity

A heuristic in the absence of a public serviceability formula: monthly capacity = gross income
/ 12 adjusted by the HECS share, minus living expenses and other debts, times 0.826 (a life
margin). That payment capacity is applied at the stressed rate (+3 percent buffer) over the
term to produce a loan estimate. Presented as a sanity check only; the lender's formal
assessment governs.

## 7. Transfer duty (rough)

Rough scales per state (NSW, VIC, QLD, WA, SA, ACT, TAS, NT) applied to the buyer's share of
the price, since shared equity purchases are generally dutied on your share. Concessions and
first home buyer exemptions vary widely and can reduce this further, which is why the app
lets you type the exact figure always shown next to your state's revenue office calculator
link.

## 8. What the tests lock down

Run `npm test`. The engine suite covers: the official structure example; the top-up rule
(clause 3.2(b)); valuation-scaled percentages (clause 6.3); the maximum price formula;
repayments (the $2,997.75 standard, extra repayments shortening payoff, frequency
consistency); planned buy-back arithmetic with the $1,000 rounding and the full-exit rule;
the improvement formula; the sale waterfall arithmetic; the forced minimum buy-back; capacity
monotonicity; and the income cap. The scraper suite covers a typical portal page, keyword-first
counts ("Bedrooms: 4"), street-type addresses, multi-line addresses, off-plan detection, and
bot-wall pages, which parse to low confidence with no crash.
