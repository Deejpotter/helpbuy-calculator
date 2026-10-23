/**
 * Australian Government Help to Buy scheme constants.
 * Every value carries its "as at" date / financial year. Source: firsthomebuyers.gov.au
 * (fetched 23 Oct 2026) unless noted. Income thresholds and improvement thresholds are
 * index-dated 1 July annually; price caps are policy-fixed, not indexed.
 */

export const SX = {
  NSW: "NSW",
  VIC: "VIC",
  QLD: "QLD",
  WA: "WA",
  SA: "SA",
  TAS: "TAS",
  ACT: "ACT",
  NT: "NT",
  JBT: "Jervis Bay Territory & Norfolk Island",
  CXCK: "Christmas Island & Cocos (Keeling) Islands",
} as const;
export type StateCode = keyof typeof SX;

/** FY 2026-27 income thresholds (NOA from FY 2025-26 required at application). */
export const INCOME_CAPS_FY2627 = {
  single: 103_000,
  singleParent: 165_000,
  joint: 165_000,
} as const;
export const INCOME_CAPS_FY2526 = {
  single: 100_000,
  singleParent: 160_000,
  joint: 160_000,
} as const;

export function incomeCapFor(applicantType: "single" | "singleParent" | "joint"): number {
  switch (applicantType) {
    case "single":
      return INCOME_CAPS_FY2627.single;
    case "singleParent":
      return INCOME_CAPS_FY2627.singleParent;
    case "joint":
      return INCOME_CAPS_FY2627.joint;
  }
}

/** Property price caps by state Ã- region (capital city / regional centre vs rest of state). */
export const PRICE_CAPS: Record<StateCode, { major: number | null; rest: number | null }> = {
  NSW: { major: 1_300_000, rest: 800_000 },
  VIC: { major: 950_000, rest: 650_000 },
  QLD: { major: 1_000_000, rest: 700_000 },
  WA: { major: 850_000, rest: 600_000 },
  SA: { major: 900_000, rest: 500_000 },
  TAS: { major: 700_000, rest: 550_000 },
  ACT: { major: 1_000_000, rest: null },
  NT: { major: 600_000, rest: 600_000 },
  JBT: { major: null, rest: 550_000 },
  CXCK: { major: null, rest: 400_000 },
};

/** Regional centres (treated as "major" for caps). Official list. */
export const REGIONAL_CENTRES: Record<string, string[]> = {
  NSW: [
    "Newcastle", "Lake Macquarie", "Illawarra", "Central Coast", "Mid-North Coast",
    "Coffs Harbour", "Grafton", "Richmond", "Tweed",
  ],
  VIC: ["Geelong"],
  QLD: ["Gold Coast", "Sunshine Coast"],
};

export type HomeType = "existing" | "new";

/** Commonwealth Share Percentage limits (from CBA scheme page + Customer Guide v260701). */
export const CSP = {
  min: 0.05,
  maxExisting: 0.3,
  maxNew: 0.4,
} as const;

export function maxCspShare(homeType: HomeType): number {
  return homeType === "new" ? CSP.maxNew : CSP.maxExisting;
}

export const RULES = {
  minDepositShare: 0.02,                 // 2% of purchase price
  maxLvr: 0.8,                           // deposit + CSP must cover >= 20% => LVR <= 80%, no LMI
  minBuybackShareOfValue: 0.05,          // each repayment >= 5% of current market value
  buybackRoundTo: 1_000,                 // ... rounded to nearest $1,000
  apraServiceabilityBuffer: 0.03,        // standard bank stress test buffer
  improvementNotifyThreshold: 21_000,    // FY2026-27, indexed
  reviewEveryYears: 5,                   // Housing Australia periodic reviews
  maxApplicants: 2,
  upfrontCostDefaults: {                 // editable in the app
    conveyancing: 2_000,
    inspections: 700,
    registration: 1_500,                 // mortgage/title registration incl. gov share
    valuationGov: 550,                   // valuations you cover under the scheme
  },
  saleCostDefaults: { agentPct: 0.025, legal: 2_000 },
} as const;

export const DEFAULTS = {
  ratePct: 6.55, // editable — RBA cash rate 4.60% (30 Sep 2026) plus a typical ~2% variable margin; verify the lender's current rate
  growthPct: 3.0,
  incomeGrowthPct: 2.5,
} as const;

export const RBA_NOTE = "RBA cash rate 4.60% (30 Sep 2026). Standard variable loans typically sit ~2% above cash — check the lender's current rate.";

/** FY labels used across the UI. */
export const FY_LABELS = {
  current: "2026-27",
  noaRequired: "FY 2025-26 Notice of Assessment",
} as const;

/** Sticky source links for the footer and inline "verify" hints. */
export const SOURCES = {
  scheme: "https://firsthomebuyers.gov.au/australian-government-help-buy-scheme",
  eligibilityTool: "https://firsthomebuyers.gov.au/australian-government-help-buy-scheme/help-buy-tools-and-resources/help-buy-eligibility-tool",
  lenders: "https://firsthomebuyers.gov.au/australian-government-help-buy-scheme/help-buy-tools-and-resources/help-buy-participating-lenders",
  thresholds: "https://firsthomebuyers.gov.au/htb-thresholds",
  priceCaps: "https://firsthomebuyers.gov.au/help-buy-tools-and-resources/help-buy-property-price-caps",
  maxPriceCalc: "https://firsthomebuyers.gov.au/help-to-buy/calculator",
  faq: "https://firsthomebuyers.gov.au/frequently-asked-questions-2",
  repaymentGuide: "https://firsthomebuyers.gov.au/HTB-repayment",
  customerGuide: "https://firsthomebuyers.gov.au/helptobuycustomerguide",
  factSheet: "https://firsthomebuyers.gov.au/media/1661",
  tmd: "https://firsthomebuyers.gov.au/media/1663",
  generalTerms: "https://firsthomebuyers.gov.au/media/1665",
  newBuild: "https://firsthomebuyers.gov.au/HTB-newbuild",
  homeImprovement: "https://firsthomebuyers.gov.au/HTB-homereno",
  cbaScheme: "https://www.commbank.com.au/home-loans/australian-government-help-to-buy-scheme.html",
  cbaRates: "https://www.commbank.com.au/personal/home-loans/interest-rates-fees.html",
} as const;

/** State revenue offices for duty verification. */
export const SRO_LINKS: Record<StateCode, string> = {
  NSW: "https://www.revenue.nsw.gov.au/taxes-duties-levies-royalties/transfer-duty",
  VIC: "https://www.sro.vic.gov.au/calculators/land-transfer-duty-calculator",
  QLD: "https://www.qld.gov.auenvironment/land/tax-sales/transfer-duty-calculator",
  WA: "https://onlineservices.wa.gov.au/content/home/duty-calculator",
  SA: "https://www.revenuesa.sa.gov.au/concessions-and-calculators/stamp-duty-calculator",
  TAS: "https://www.nre.tas.gov.au/land-tasmania/titles-and-property/land-transfer-duty",
  ACT: "https://www.revenue.act.gov.au/duties/land-duty",
  NT: "https://nt.gov.au/property/land-and-property-buying-and-selling/stamp-duty-on-property",
  JBT: "https://www.ato.gov.au/about-ato/legislation-detail/?page=3&title=Other QLD Taxes_Duties_and_Royalties",
  CXCK: "https://www.ato.gov.au/about-ato/legislation-detail/?page=3",
};
