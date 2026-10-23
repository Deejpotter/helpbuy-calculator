# Research map â€” Australian Government Help to Buy (fetched 23 Oct 2026)

All facts below were read from these pages the same day this app was built. Where a number is
necessarily an estimate (duty, borrowing capacity, default rate, growth) the app says so.

## Pages read (full link map)

| Page | What it gave the app |
| --- | --- |
| firsthomebuyers.gov.au/australian-government-help-buy-scheme | Core structure: 2% min deposit, up to 30%/40%, 10,000 places/yr, apply via participating lenders, 90-day reserved place, Rob's $800k worked example |
| â€¦/help-buy-tools-and-resources | Hub of tools/guides; links to every page below |
| â€¦/help-buy-eligibility-tool | The questionnaire the user already did (SPA) â€” no math extractable |
| â€¦/help-buy-participating-lenders | Panel: CommBank, Bank Australia, Teachers Mutual Bank group (TMB/Health Professionals/Firefighters/UniBank), Queensland Country Bank |
| firsthomebuyers.gov.au/htb-thresholds | Income thresholds FY25-26 â†’ FY26-27: single $100kâ†’$103k; single parent & joint $160kâ†’$165k; NOA for prior FY; CSP event thresholds $21k (improvement / build variation, FY26-27); price caps NOT indexed |
| â€¦/help-buy-property-price-caps | Caps: NSW 1.3M/800k Â· VIC 950k/650k Â· QLD 1M/700k Â· WA 850k/600k Â· SA 900k/500k Â· TAS 700k/550k Â· ACT 1M Â· NT 600k/600k Â· JBT&NI 550k Â· CX&Cocos 400k; regional centre list (Geelong, Gold Coast, Sunshine Coast, Newcastle & Lake Macquarie, Illawarra, Central Coast, Mid-North Coast, Coffsâ€“Grafton, Richmondâ€“Tweed); postcode caveat |
| â€¦/help-to-buy/calculator | Official Maximum Purchase Price calculator â€” takes deposit + estimated loan only; formula = (D+L)/(1âˆ’maxCSP), capped by price caps. No income/repayment logic â€” the gap this app fills |
| â€¦/frequently-asked-questions-2 | No interest on gov share; proportional gains/losses; max 2 applicants; hard income cap; NOA required; new-home definition (40%); move in at settlement (building: within 3 months); reviews â‰¥ every 5y; over cap 2 consecutive FYs â†’ affordable-forced repayment; can combine with FHOG/duty concessions/FHSS but NOT other shared equity/loans/guarantees |
| firsthomebuyers.gov.au/HTB-repayment (PDF, via reader proxy) | â€œRepaymentâ€ = buy-back. Minimum 5% of current market value (nearest $1,000) unless remaining share <5%; fund via savings/loan increase/combo; valuation each time (you pay); cannot pay out loan and keep CSP; sale repays CSP from proceeds; breach â†’ CSP% increased to protect dollar value |
| firsthomebuyers.gov.au/helptobuycustomerguide (PDF, 48pp v260701) | CSP range 5â€“30% existing / 5â€“40% new; â€œcontribute the maximum you canâ€ + gap test; improvement rule â‰¥$21k: CSP%post = CSP%pre Ã- Vpre/Vpost (Simon & Ken 20%â†’18.42%); sale payout order (loan â†’ Commonwealth â†’ you), gov gets share Ã- greater(sale price, valuation); refinance to non-participant requires full buy-out; participant changes; death/estates; reviews |
| commbank.com.au/home-loans/australian-government-help-to-buy-scheme.html | CBA is the only major bank on the panel; DP+CSP â‰¥ 20% â‡’ LVR â‰¤ 80% (no LMI); P&I up to 30y (IO construction-only); ongoing income-cap compliance â†’ buy-back if it lapses; Nura $750k/Geelong example; TMD + fact sheet links |
| (nav) first-home-super-saver-scheme Â· 5% Deposit Scheme | Sibling schemes; app links out, doesn't model them |

## Encoded constants (constants.ts)

- CSP: 5% min, 30% max existing, 40% max new; DP+CSP â‰¥ 20% â‡’ LVR â‰¤ 80% (equivalent check).
- Income caps FY26-27: 103k / 165k / 165k (with FY25-26 prior column in comments).
- Price caps: the 10-row table above + regional-centre classification.
- Improvement/build-variation notify threshold: $21k (FY26-27).
- Min buy-back: 5% of value, rounded to nearest $1,000; remaining <5% â‡’ repay in full.
- Reviews: at least every 5 years, 2-consecutive-FY over-cap test.
- APRA serviceability buffer: +3% (stressed repayment display).

## Deliberate simplifications (flagged in the UI)

1. Duty: per-state rough scales on the buyer's share only, with SRO links + manual override.
   Real concessions (e.g. QLD <700k FHB exemption, NSW <800k/VIC <600k-type regimes, ACT ~fully
   exempt â‰¤$1M) can zero it â€” the user enters the true number when they have it.
2. Default rate 5.5% is a placeholder in an editable field; no live rate feed.
3. Borrowing capacity: surplus-based heuristic (income âˆ’ living âˆ’ debts âˆ’ HECS haircut, margin
   17%, +3% stress). Formal assessment differs per lender.
4. Buy-back funding by loan increase adds the amount to the balance; the real repayment must be
   re-quoted by the lender (noted in the projection).
5. Sale assumes share-of-price = share-of-valuation (the Guide takes the greater of the two).
6. Growth/income paths are annual compounding assumptions, not forecasts.

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
  paste-shortcut flow â€” no fake "import" that quietly returns junk.

