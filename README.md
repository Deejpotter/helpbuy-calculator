# Help to Buy Studio

An independent, no-signup planner for the **Australian Government Help to Buy Scheme** (shared
equity): model repayments, the Commonwealth share, buy-backs, improvements, sales and
eligibility â€” either from manual inputs or by importing an online property listing link.

Static React app. No backend, no account. Your current scenario and compare slots persist
only in this browser's localStorage â€” nothing leaves the device; a shared link encodes the
numbers in the URL.

## Run

```powershell
npm install
npm run dev        # http://localhost:5173
npm test           # vitest â€” 19 unit tests on the scheme engine + scraper
npm run build      # type-check + production build to dist/
```

## What it does

**Inputs** (left panel; every field editable)
- Applying as single / single parent / joint, income â†’ eligibility vs the FY 2026-27 caps
  ($103k / $165k, indexed 1 July).
- Property: state/territory + capital-vs-rest (official price caps incl. regional-centre list),
  new vs existing (40% vs 30% max government share), price, deposit, "most the bank will lend".
- Listing import: paste a listing URL â€” fetched through CORS-friendly reader relays and parsed
  (price, address with multi-word suburbs, beds/baths/cars in both digit-first and keyword-first
  formats, state, region, new/existing). Sites that deliberately wall off readers
  (realestate.com.au, domain.com.au â€” both tested) are detected instantly, explained
  brand-specifically, and the text-paste path opens automatically with an "Open the listing" link;
  you copy the overview block and paste it. Everything stays editable â€” parsing is a prefill,
  never final.
- Loan: term (P&I only, â‰¤ 30y â€” interest-only is construction-only in the scheme), rate,
  weekly/fortnightly/monthly, extra repayments.
- Plans & assumptions (advanced): growth, forced-income-cap year, buy-back plan (â‰¥ 5% of value,
  rounded to $1,000 â€” scheme minimum), home-improvement modelling (official CSP adjustment
  formula), a sale year, agent %, legal fees, upfront costs, duty override, ongoing costs.

**Results** (right panel)
- Repayments at each frequency + the APRA +3% stressed repayment + payoff years + total interest.
  You only service your share â€” there's no interest or rent on the Commonwealth share.
- Eligibility checklist sourced from the official rules, with official-source links.
- Equity timeline (SVG): your stake vs loan balance vs the Commonwealth share over 40 years.
- Sale waterfall in the Guide's payout order (agent â†’ loan â†’ Commonwealth share â†’ you), at any
  year, plus a horizons table.
- Settlement cash tally (deposit + duty estimate + costs) and a rough serviceability check.

**Scenario tools**
- Compare A/B/C slots (kept in localStorage) â€” same deposit, different houses.
- "Share this scenario" copies a URL that encodes every input in the hash.
- Print-friendly output.

## Accuracy & sources

Every scheme constant is sourced and dated (see `docs/RESEARCH.md` and the source footer in the
app): firsthomebuyers.gov.au (scheme page, thresholds, price caps, FAQs, Repayment Guide,
Customer Guide v260701) and the CommBank scheme page â€” fetched 23 Oct 2026. Calculations are
unit-tested against the Guide's own worked examples (Rob â†’ CSP 30% of $800k; 5%-minimum
buy-backs; the 20% Ã- Vpre/Vpost improvement rule; P&I math).

Known approximations, clearly flagged in the UI:
- Transfer duty estimates are rough state-scale estimates **on your share of the value** â€”
  verify on your SRO calculator (or type the real figure).
- Borrowing capacity is a heuristic (APRA +3% buffer) â€” your lender's assessment governs.
- Default interest rate (5.5%) is an editable placeholder, not a quote.
- Property-growth and income-growth are your assumptions, not forecasts.

Not affiliated with Housing Australia, CommBank or any listed party. General information only â€”
not financial advice.
