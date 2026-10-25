# Research map - Australian Government Help to Buy (fetched 23 Oct 2026)

All facts below were read from these pages the same day this app was built. Where a number is
necessarily an estimate (duty, borrowing capacity, default rate, growth) the app says so.

## Pages read (full link map)

| Page | What it gave the app |
| --- | --- |
| firsthomebuyers.gov.au/australian-government-help-buy-scheme | Core structure: 2% min deposit, up to 30%/40%, 10,000 places/yr, apply via participating lenders, 90-day reserved place, Rob's $800k worked example |
| .../help-buy-tools-and-resources | Hub of tools/guides; links to every page below |
| .../help-buy-eligibility-tool | The questionnaire the user already did (SPA) - no math extractable |
| .../help-buy-participating-lenders | Panel: CommBank, Bank Australia, Teachers Mutual Bank group (TMB/Health Professionals/Firefighters/UniBank), Queensland Country Bank |
| firsthomebuyers.gov.au/htb-thresholds | Income thresholds FY25-26 -> FY26-27: single $100k->$103k; single parent & joint $160k->$165k; NOA for prior FY; CSP event thresholds $21k (improvement / build variation, FY26-27); price caps NOT indexed |
| .../help-buy-property-price-caps | Caps: NSW 1.3M/800k ,  VIC 950k/650k ,  QLD 1M/700k ,  WA 850k/600k ,  SA 900k/500k ,  TAS 700k/550k ,  ACT 1M ,  NT 600k/600k ,  JBT&NI 550k ,  CX&Cocos 400k; regional centre list (Geelong, Gold Coast, Sunshine Coast, Newcastle & Lake Macquarie, Illawarra, Central Coast, Mid-North Coast, Coffs-Grafton, Richmond-Tweed); postcode caveat |
| .../help-to-buy/calculator | Official Maximum Purchase Price calculator - takes deposit + estimated loan only; formula = (D+L)/(1-maxCSP), capped by price caps. No income/repayment logic - the gap this app fills |
| .../frequently-asked-questions-2 | No interest on gov share; proportional gains/losses; max 2 applicants; hard income cap; NOA required; new-home definition (40%); move in at settlement (building: within 3 months); reviews >= every 5y; over cap 2 consecutive FYs -> affordable-forced repayment; can combine with FHOG/duty concessions/FHSS but NOT other shared equity/loans/guarantees |
| firsthomebuyers.gov.au/HTB-repayment (PDF, via reader proxy) | "Repayment" = buy-back. Minimum 5% of current market value (nearest $1,000) unless remaining share <5%; fund via savings/loan increase/combo; valuation each time (you pay); cannot pay out loan and keep CSP; sale repays CSP from proceeds; breach -> CSP% increased to protect dollar value |
| firsthomebuyers.gov.au/helptobuycustomerguide (PDF, 48pp v260701) | CSP range 5-30% existing / 5-40% new; "contribute the maximum you can" + gap test; improvement rule >=$21k: CSP%post = CSP%pre x Vpre/Vpost (Simon & Ken 20%->18.42%); sale payout order (loan -> Commonwealth -> you), gov gets share x greater(sale price, valuation); refinance to non-participant requires full buy-out; participant changes; death/estates; reviews |
| commbank.com.au/home-loans/australian-government-help-to-buy-scheme.html | CBA is the only major bank on the panel; DP+CSP >= 20%  =>  LVR <= 80% (no LMI); P&I up to 30y (IO construction-only); ongoing income-cap compliance -> buy-back if it lapses; Nura $750k/Geelong example; TMD + fact sheet links |
| (nav) first-home-super-saver-scheme ,  5% Deposit Scheme | Sibling schemes; app links out, doesn't model them |

## Encoded constants (constants.ts)

- CSP: 5% min, 30% max existing, 40% max new; DP+CSP >= 20%  =>  LVR <= 80% (equivalent check).
- Income caps FY26-27: 103k / 165k / 165k (with FY25-26 prior column in comments).
- Price caps: the 10-row table above + regional-centre classification.
- Improvement/build-variation notify threshold: $21k (FY26-27).
- Min buy-back: 5% of value, rounded to nearest $1,000; remaining <5%  =>  repay in full.
- Reviews: at least every 5 years, 2-consecutive-FY over-cap test.
- APRA serviceability buffer: +3% (stressed repayment display).

## Deliberate simplifications (flagged in the UI)

1. Duty: per-state rough scales on the buyer's share only, with SRO links + manual override.
   Real concessions (e.g. QLD <700k FHB exemption, NSW <800k/VIC <600k-type regimes, ACT ~fully
   exempt <=$1M) can zero it - the user enters the true number when they have it.
2. Default rate 6.55% is an editable assumption (RBA cash 4.60% plus a typical margin); no live
   rate feed.
3. Borrowing capacity: surplus-based heuristic (income - living - debts - HECS haircut, margin
   17%, +3% stress). Formal assessment differs per lender.
4. Buy-back funding by loan is modelled as a new loan per payment: same rate and term, principal
   and interest, amortised from its own year. The real repayment and approval are the lender's,
   so the extra repayment is indicative (noted in the results).
5. Sale assumes share-of-price = share-of-valuation (the Guide takes the greater of the two).
6. Growth/income paths are annual compounding assumptions, not forecasts.

## Round 2 sources (read 23 Oct 2026, same day)

- **Target Market Determination** (media/1663, effective 5 Dec 2025): confirms scheme design. New facts:
  buyers may *choose* to pay LMI at a buy-back (LMI is not required at origination); the product is not
  designed for off-the-plan settlements more than 90 days out, investment/business property, corporate
  or trust purchasers, or people who can buy without help. Surfaces in the app as the LMI note on
  loan-funded buy-backs.
- **Fact Sheet** (media/1661, 1 July 2026 version 260701): confirms every constant (2% deposit, 30/40%,
  income caps, price-cap table, regional centres). Adds application-stage do's and don'ts (deposit or
  auction bids only with conditional approval; check insurability; use the Letter of Support).
- **Customer Guide v260701** was already read twice via two URLs (/helptobuycustomerguide and
  /HTBCustomerGuide serve the identical 48-page v260701 document).
- **Home Improvement Guide** (8pp): costs inside a rolling 12-month window aggregate toward the $21,000
  threshold; notify BEFORE starting; un-notified improvements get no share adjustment; improvements are
  funded by you only; valuations assess the works alone, not market drift.
- **New Build Guide** (15pp): land + build within the cap; begin building within 12 months of settlement,
  finish within 36; 21 days notice for contract changes; tip to hold ~5% of build cost as buffer; contact
  helptobuysupport@housingaustralia.gov.au.
- **General Terms** (68pp): the binding contract. Encoded in the engine:
  - 6.1: CC = max(0, min(MaxCC, PP - Loan - Deposit)); CC at or below 0 -> not eligible.
  - 3.2(b): if the resulting structure puts the loan above 80% of value, the government MUST increase its
    contribution (within the maximum); the loan may then be smaller than the bank's maximum. Engine now
    models the top-up instead of failing the LVR check.
  - 6.3: initial CSP% = CC / min(Total Purchase Price, initial Valuation). An initial valuation below the
    price raises the government's percentage. Engine gained an optional initial-valuation input.
  - 7.1: Commonwealth Share Amount = CSP x greater(valuation, sale price) - matches the Guide example and
    the app's sale waterfall.
  - 8.2/8.3: voluntary payments reduce the share by at least 5 percentage points of value (nearest $1,000;
    otherwise the payment can be declined), a fresh valuation for each payment, valid 90 days.
  - 9.1: payment waterfall codified (scheme enforcement costs, lender principal + accrued interest,
    Housing Australia share, lender balance, other interests, then you).
  - 6.4: share recalculations: payments, significant home improvements (notified, council approvals
    obtained), wrongdoing (neglect/uninsured damage raises the share; $20k indexed threshold), and
    new-build cost variations (government-funded or at least $20k).

## Framework notes

- No Context7 MCP server is installed in this environment; Context7's public HTTP API was used
  instead (library ids /reactjs/react.dev and /vitejs/vite) to confirm Vite 7 config patterns.
- Stack: React 19 + Vite 7 + TypeScript; vitest for the engine; hand-rolled SVG charts; plain
  CSS design system (no component library, no Tailwind) per the no-card design brief.
- Listing import fetches through CORS-permissive reader relays (r.jina.ai, then allorigins),
  verified working from a browser context on the day, with a paste-text fallback.
- **realestate.com.au and domain.com.au are deliberately bot-walled** (tested 23 Oct 2026:
  REA's pages via Akamai 403 even through r.jina.ai; their internal listings JSON API answers
  429 behind a Kasada challenge). The app detects these walls, says so per-brand, and opens the
  paste-shortcut flow - no fake "import" that quietly returns junk.

