# Help to Buy Studio

An independent, no-signup planner for the **Australian Government Help to Buy Scheme** (shared
equity). Work out what a home would really cost you: repayments on your share, how much the
government would own, when and how to buy it back, what you would walk away with at sale, and
whether a property clears the scheme's income and price rules.

Numbers come from manual input, or from a listing you import by web address. Everything runs in
your browser: no account, no server, and your scenario is stored only in this browser
(localStorage). A shared link is just a URL that carries your numbers.

This is a planning and education tool. It is not the official tool, not advice, and not a quote.
Only the lender in the scheme confirms real eligibility.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 30 unit tests on the calculation engine and the listing parser
npm run build    # type check + production build into dist/
npm run preview  # serve dist/ locally to check the production bundle
```

Requires Node 20 or newer (Node 22 also fine). No other services needed.

## How the app works, top to bottom

On a first visit a three step guided setup runs first: who is buying, the home, the loan. It has two
one click exits: **Use the defaults** loads the official example (an $800,000 home, a 30 percent
share, a 6.55 percent rate), and **Skip setup** keeps whatever is already on screen. Neither locks
anything in.

1. **Import bar.** Paste a listing link (any estate agent site we can legally read) and press
   Read listing. The app fetches the page through a reader relay and pre-fills price, address,
   bedrooms and state. Big portals (realestate.com.au, domain.com.au) block automated reading by
   design; the app tells you that straight away and opens the paste box instead: copy the top of
   the listing (address, price, beds) and press Parse. Importing is always a prefill; every
   field stays editable.

2. **Inputs (left side), numbered 01 to 06.**
   - 01 Your situation: single, single parent or joint, plus combined taxable income. Income is
     checked against the FY 2026-27 caps ($103,000 single; $165,000 single parent or joint).
   - 02 The property: state or territory, capital city or rest of state, new or existing, price,
     optional initial valuation, deposit, and the most the bank will lend. The government
     contribution mode is here too: default "bridge the gap", or set a share manually.
   - 03 The loan: term (20, 25 or 30 years, principal and interest), interest rate, Payment
     frequency and extra repayments.
   - 04 Plans: property growth assumption, buy-back plan, one modelled improvement, and the year
     your income would push above the cap (models a forced minimum buy-back).
   - 05 Selling and one-off costs: sale year slider, agent percentage, sale legal fees, upfront
     costs, transfer duty (estimate or exact), and monthly ongoing costs.
   - 06 Serviceability inputs: HECS share of income, other debts, living expenses, income
     growth. Powers a rough borrowing-capacity check in the results.

3. **Results (right side), numbered 01 to 07.**
   - Hero strip: repayment, your share percent, government share dollars, and the minimum
     buy-back today. Below it, a split bar showing how the purchase price is covered (your
     cash, your loan, the government).
   - 01 Repayment detail: each frequency, the stressed repayment at rate plus 3 percent (the
     bank buffer), payoff years and total interest.
   - 02 Will it work? The scheme rules: income cap, 2 percent deposit, loan at 80 percent or
     less (no LMI), government share range, price cap and the lender rules. A "things to sort"
     box lists what to change with one-click fixes, every row explains itself in plain words,
     and a Plain words list defines LMI, LVR, equity and the rest.
   - 03 Your share over time: a year by year chart of your equity, loan balance and the
     government share in dollars (up to a 60 year horizon), plus a milestones table and any
     modelled events.
   - 04 Path to full ownership: with a plan on, an equity journey bar (today to 100 percent),
     a summary of the modelled payments, the total borrowed and the repayment the new loans add;
     buy-backs are funded by a new loan by default (switch it to savings if you prefer), and
     without a plan there's a one-click "model a buy-back plan".
   - 05 Selling: slide the sale year and see the payout waterfall (agent, loan payout,
     government share, then you) and a horizons table.
   - 06 Cash at settlement: deposit plus duty estimate plus other costs, and monthly ongoing
     costs.
   - 07 Serviceability sanity check: rough capacity from your income and expenses at the
     stressed rate, compared with the loan you entered.

4. **Scenario tools.** Save the current setup into compare slots A, B or C (kept in this
   browser) to compare the same deposit across houses. Share this scenario copies a link that
   encodes every input. Print gives a clean paper layout. Reset to defaults clears the saved
   scenario and loads the example (compare slots are kept).

## The scheme in a nutshell

- The government contributes between 5 and 30 percent of the price for an existing home, or
  5 to 40 percent for a new or off-plan home; shares are only measured against the price caps.
- Minimum 2 percent deposit, and your deposit plus the government share must cover at least
  20 percent of the price, so the loan never exceeds 80 percent of value and LMI does not apply
  at purchase. If the bank's maximum would push you over 80 percent, the government's share is
  increased so your loan comes in at or below 80 percent (it can end up smaller than the bank's
  maximum).
- Income limits for FY 2026-27: $103,000 single; $165,000 for single parents and joint
  applicants, judged on last financial year's tax Notice of Assessment. Caps rise every 1 July.
- Property price caps by area (NSW $1.3M or $800k; VIC $950k or $650k; QLD $1M or $700k; WA
  $850k or $600k; SA $900k or $500k; TAS $700k or $550k; ACT $1M all areas; NT $600k all
  areas; Jervis Bay and Norfolk $550k; Christmas and Cocos $400k). Always confirm your exact
  suburb with the official postcode tool.
- You pay no interest and no rent on the government share, but its dollar value follows the
  market. Buy-backs need a fresh valuation (you pay) and must be at least 5 percent of the
  value at that time, rounded to $1,000. Reviews happen at least every 5 years; two tax years
  over the cap can require a buy-back, but only if you can afford it.

## How the numbers are computed

Every formula, the official worked examples used as test fixtures, and each rule's source are
documented in [docs/CALCULATIONS.md](docs/CALCULATIONS.md). Research notes, sources and
decisions are in [docs/RESEARCH.md](docs/RESEARCH.md). A field-by-field walkthrough is in
[docs/USER-GUIDE.md](docs/USER-GUIDE.md). Deployment and bundle sizes are in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Accuracy, and what this tool does not do

- Transfer duty is a rough estimate on your share of the price from published scales. State
  concessions differ; check your revenue office calculator or type the exact amount.
- Borrowing capacity is a heuristic. Your lender's formal assessment always wins.
- The default rate (5.5 percent) is an editable placeholder, not a quote.
- Growth and income paths are your assumptions, not forecasts.
- The app never stores anything online; it cannot know your CBA login, and it does not model
  the First Home Guarantee, FHSS or state schemes beyond links.

## Sources

All scheme facts were read from these pages (fetched 23 Oct 2026) and are linked in the app
footer too:

- Scheme overview: [firsthomebuyers.gov.au](https://firsthomebuyers.gov.au/australian-government-help-buy-scheme)
- Customer Guide, Repayment Guide, New Build Guide, Home Improvement Guide, Fact Sheet
  and Target Market Determination (PDFs and pages on [firsthomebuyers.gov.au](https://firsthomebuyers.gov.au))
- Help to Buy General Terms (the 68 page contract)
- The CommBank Help to Buy page and its panel of lenders

First release of this repository, MIT licensed. Not affiliated with Housing Australia,
CommBank or any listed party. General information only, not financial advice.
