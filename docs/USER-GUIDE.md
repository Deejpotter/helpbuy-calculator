# User guide, field by field

Everything you can set and everything the app tells you back. Screenshot-free by design; the
interface mirrors this text closely.

## The import bar (top of the page)

- **Paste a listing link, then Read listing.** The app fetches the page through a reader relay
  and imports what it can reliably see: price, address (it understands street types and
  two-line addresses), suburb (multi-word suburbs like Frankston North are fine), beds, baths,
  car spaces, new or existing, state, and a region guess for the price cap.
- **Blocked sites.** realestate.com.au and domain.com.au actively wall off automated readers
  (we tested both: a web application firewall plus challenge service). The app detects this in
  one step, tells you which site did it, and opens the paste box with an Open the listing link.
  Copy the overview: address line, price, beds / baths / car spaces. Then press Parse pasted
  text.
- **Always editable.** Importing is a prefill, never a final answer. If anything parsed wrong,
  fix it in 02 The property.

## 01 Your situation

- **Applying as.** Single, single parent, or joint. This picks the income cap.
- **Annual taxable income.** The number from your last tax Notice of Assessment, not your
  salary. The note under the field shows the current cap: $103,000 for a single applicant,
  $165,000 for single parents and joint applicants (FY 2026-27, rises every 1 July).

## 02 The property

- **Home type.** Existing gets a maximum 30 percent government share; new or off-plan gets
  40 percent.
- **State or territory and location class.** Capital city and regional centre versus rest of
  state. The regional centre list for pricing is: Geelong; Gold Coast; Sunshine Coast; and in
  New South Wales, Newcastle and Lake Macquarie, Illawarra, Central Coast, Mid North Coast,
  Coffs Harbour and Grafton, and Richmond Tweed. Price caps are not indexed, so always confirm
  your exact suburb and postcode with the official postcode tool linked in the results.
- **Purchase price, initial valuation, deposit, most the bank will lend.** Valuation is
  optional: if a valuer values the home below the price, the government's share percentage is
  measured on the lower figure (clause 6.3 of the General Terms), so add it when you have it.
- **Government contribution.** "Bridge the gap" means: contribution = price minus deposit minus
  loan, up to the 30 or 40 percent limit. If that structure would leave the loan above 80
  percent of value, the contribution increases so the loan comes in at 80 percent or less
  (clause 3.2(b)); your loan may end up smaller than the bank's maximum. Or set the share
  yourself with the slider (between 5 and 30 / 40 percent).

## 03 The loan

- **Term.** 20, 25 or 30 years, principal and interest only. Interest-only is allowed in the
  scheme only while a home is being built.
- **Interest rate.** Default 5.5 percent is a placeholder; use your lender's real rate.
- **Frequency and extra repayments.** Weekly, fortnightly or monthly, plus anything extra you
  pay each period. Your mortgage payment covers your share only; the government share costs
  nothing as you go.

## 04 Plans: buy-backs and improvements

- **Buy-back plan.** Turn it on, pick the first year, the percent of value to buy back each
  year (5 percent is the scheme minimum), and whether you pay from savings or by borrowing
  more. The results show the journey to full ownership; borrowing more can bring LMI back if
  the loan goes over 80 percent of value, and the app tells you so.
- **Improvement (optional).** If you model one, remember the real rules: costs add up over a
  rolling 12 month window toward the $21,000 notification threshold; you must notify before
  starting; the share adjustment only happens if you notified; and you pay for the works
  yourself.
- **Income above the cap from year.** Optional stress test: Housing Australia reviews at least
  every 5 years, and two tax years over the cap can require a buy-back, but only if you can
  afford it. The app models the minimum payment in that year.

## 05 Selling and one-off costs

- **Sale year slider.** Zero means no sale is modelled. Move it and section 05 shows the
  waterfall: sale price, minus agent and legal costs, minus loan payout, minus the government
  share, equals cash to you. The government receives its share of the greater of sale price or
  current valuation.
- **Costs.** Agent percent, sale legal fees, other upfront costs (conveyancing, inspections,
  registration, the government's valuations), transfer duty (estimate, or type the exact
  number when you have it), and monthly ongoing costs such as rates, insurance and strata.

## 06 Serviceability inputs

- Income blocked by HECS repayments, other debt repayments, living expenses per month, and
  assumed income growth. These drive the rough borrowing-capacity check in results section 07.
  It is a heuristic: your lender's formal assessment decides.

## Results section by section

- **Hero strip.** Repayment per chosen frequency, your share percent, the government share in
  dollars, and the minimum buy-back today (5 percent of current value, rounded to $1,000).
- **Ownership split bar.** Your cash, your loan, and the government share, as shares of the
  purchase price.
- **01 Repayment detail.** All three frequencies, the stressed repayment (rate plus the
  regulator's 3 percent buffer), loan-free year and lifetime interest.
- **02 Checked against the rules.** Seven checks: income cap, 2 percent deposit, loan at 80
  percent or less (no LMI at purchase), government share between 5 and 30 / 40 percent, price
  cap, the gap test (if deposit plus borrowing already buys the home, lenders may rule the
  scheme out), and the loan requirements. Each row shows a chip: Meets, Fix or Review.
- **03 Your share over time.** A 40 year chart: green for your stake, dotted clay for the loan
  balance, amber for the government share in dollars. Details hold a milestones table and the
  modelled buy-back list.
- **04 Path to full ownership.** With a plan: a journey bar from today's ownership to 100
  percent and a payment summary. Without: a one-click model plan button with the key rules.
- **05 Selling.** Waterfall at the chosen year plus which years in 5 / 10 / 15 / 20 / 30 give
  what, at your assumptions.
- **06 Cash at settlement.** Deposit, duty (estimate or manual), other upfront costs, total
  cash needed, and monthly ongoing costs.
- **07 Serviceability sanity check.** Rough capacity from section 06 inputs at the stressed
  rate, next to the loan you entered. If the estimate is far below your loan, right-size the
  price.

## Scenario tools

- **Compare slots.** Set a case, press Save current and pick A, B or C. Change the numbers and
  save the next. Slots stay in this browser and compare price, share, loan, repayment,
  interest, cash and the price cap result.
- **Share this scenario.** Copies a link that carries all your inputs in the URL. Opening a
  shared link loads that scenario, and it then becomes your saved local state too.
- **Persistence.** The open scenario saves itself in this browser's localStorage on every
  change; nothing is sent anywhere. Start over clears it (compare slots stay).
- **Print.** Clean layout without inputs or buttons.
