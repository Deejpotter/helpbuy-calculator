/**
 * Property listing import. Australian listing sites (realestate.com.au, domain.com.au, ...)
 * block direct browser fetches (CORS + bot walls), so we fetch through the r.jina.ai reader
 * proxy, which returns plain text of the page. If that fails or is blocked, the UI offers a
 * paste-the-text fallback. Every parsed field stays editable - never auto-final.
 */

import { REGIONAL_CENTRES, type StateCode } from "./constants";

export type ListingField = {
  value: number | string | null;
  confident: boolean;
  matched?: string;
};

/** Human-readable error for sites that reject automated readers. */
export class SiteBlockedError extends Error {
  site: string;
  url: string;
  constructor(site: string, url: string) {
    super(`${site} actively blocks automated readers (a "bot wall"). Copy & paste works instead.`);
    this.site = site;
    this.url = url;
    this.name = "SiteBlockedError";
  }
}

export type ListingGuess = {
  url: string;
  price: ListingField & { value: number | null };
  address: ListingField;
  suburb: ListingField;
  beds: ListingField & { value: number | null };
  baths: ListingField & { value: number | null };
  cars: ListingField & { value: number | null };
  homeContext: "new" | "existing" | null;
  state: StateCode | null;
  regionGuess: "major" | "rest" | null;
  confidence: "high" | "medium" | "low" | "none";
  usedSnippet: string;
};

export function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    if (!/\./.test(parsed.hostname)) throw new Error("not a URL");
    return parsed.toString();
  } catch {
    return "";
  }
}

/** Pages from sites that wall off readers come back looking like these. */
const BLOCK_MARKERS: RegExp[] = [
  /failover-waf/i,
  /errors\.edgesuite\.net/i,
  /\baccess denied\b/i,
  /\bforbidden\b/i,
  /\berror 40\d\b/i,
  /\btoo many requests\b/i,
  /\bcaptcha\b/i,
  /\bpardon our interruption\b/i,
  /\battention required\b/i,
  /\baccess to this page has been denied\b/i,
  /\byou don'?t have permission\b/i,
];

const SITE_NAMES: Array<[RegExp, string]> = [
  [/realestate\.com\.au/i, "realestate.com.au"],
  [/domain\.com\.au/i, "domain.com.au"],
  [/house\.co\.au|homely\.com\.au/i, "Homely"],
];

export function siteLabel(url: string): string {
  for (const [re, name] of SITE_NAMES) if (re.test(url)) return name;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "the site"; }
}

function looksBlocked(text: string): boolean {
  if (text.length < 4000) {
    for (const re of BLOCK_MARKERS) if (re.test(text.slice(0, 4000))) return true;
  }
  return false;
}

/** Fetch page text through CORS-friendly reader relays. Throws SiteBlockedError when walled. */
export async function fetchListingText(url: string): Promise<{ text: string; via: "jina" | "allorigins" }> {
  // 1) reader proxy (best markdown/text extraction)
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: "text/plain" } });
    if (res.ok) {
      const text = await res.text();
      if (text.trim().length > 300) {
        if (looksBlocked(text)) throw new SiteBlockedError(siteLabel(url), url);
        return { text, via: "jina" };
      }
    }
  } catch (e) {
    if (e instanceof SiteBlockedError) throw e; // defensible signal - don't retry unknown relays for REA-class walls
  }
  // 2) CORS relay of the raw HTML
  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const text = await res.text();
      if (text.trim().length > 300) {
        if (looksBlocked(text)) throw new SiteBlockedError(siteLabel(url), url);
        return { text, via: "allorigins" };
      }
    }
  } catch (e) {
    if (e instanceof SiteBlockedError) throw e;
  }
  throw new Error("Couldn't read that listing. Use “Paste the listing text instead” below.");
}

const STATE_HINTS: Array<[StateCode, RegExp]> = [
  ["NSW", /\bNSW\b|\bnew\s?south\s?wales\b/i],
  ["VIC", /\bVIC\b|\bvictoria\b/i],
  ["QLD", /\bQLD\b|\bqueensland\b/i],
  ["WA", /\bWA\b|\bwestern\s?australia\b/i],
  ["SA", /\bSA\b|\bsouth\s?australia\b/i],
  ["TAS", /\bTAS\b|\btasmania\b/i],
  ["ACT", /\bACT\b|\baustralian\s?capital\s?territory\b/i],
  ["NT", /\bNT\b|\bnorthern\s?territory\b/i],
];

const STREET_TYPE = String.raw`(?:St|Street|Rd|Road|Dr|Drive|Ave|Avenue|Ct|Court|Pl|Place|Cres|Crescent|Blvd|Boulevard|Bvd|Hwy|Highway|Pde|Parade|Cl|Close|Tce|Terrace|Ln|Lane|Way|Gve|Grove|Cct|Circuit|Esplanade|Esp|Hts|Heights|Loop|Vw|View|Pkwy|Parkway|Exit|Track|Sector)`;
const ADDRESS_RE = new RegExp(
  String.raw`([0-9]{1,5}[A-Za-z]?\/?[A-Za-z' -]{2,40}\s${STREET_TYPE}\.?,?\s[A-Za-z' -]{2,30}?\s(?:VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\s\d{4})`,
  "i",
);
/** Readers often break the address over two lines: "12 Green St\nRichmond VIC 3121". */
const LINE_ADDR_RE = new RegExp(
  String.raw`\b([0-9]{1,5}[A-Za-z]?\/?[^\n]{2,60}?)\n\s*([^\n|]{2,40}?)\s+(VIC|NSW|QLD|WA|SA|TAS|ACT|NT)\s+(\d{4})\b`,
);

const BOTH_ORDER_COUNTS = true;

export function parseListingText(text: string, url: string): ListingGuess {
  const buf = text.slice(0, 60_000); // regex over the head of the doc is plenty

  // price: collect $-like amounts, prefer the first plausible one (≥ 75k), ignore $pw rent-ish
  const priceMatches = [...buf.matchAll(/\$\s?([\d][\d,]{4,11})/g)].map((m) => ({
    match: m[0],
    value: Number(m[1].replace(/,/g, "")),
    index: m.index ?? 0,
  })).filter((p) => p.value >= 75_000 && p.value <= 20_000_000);
  const rential = /\/\s?(week|wk|pw|month|annum)\b/i;
  const price =
    priceMatches.filter((p) => !rential.test(buf.slice(p.index, p.index + 30)))[0] ?? null;

  // address: line-broken form first ("12 Green St / Richmond VIC 3121"), then street-type
  // comma form, then the loose comma pattern
  let addressRef: { value: string; confident: boolean; matched: string } | null = null;
  let suburbRef: string | null = null;
  const lineM = buf.match(LINE_ADDR_RE);
  if (lineM) {
    suburbRef = lineM[2].trim();
    addressRef = { value: `${lineM[1].trim()}, ${suburbRef} ${lineM[3]} ${lineM[4]}`, confident: true, matched: lineM[0] };
  } else {
    const addrMatch = buf.match(ADDRESS_RE) ?? buf.match(/([0-9]{1,3}[A-Za-z]?\/?[^\n|,]{4,60},\s?[^\n|,]{2,40},?\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s?\d{4})/);
    if (addrMatch) {
      addressRef = { value: addrMatch[0].trim(), confident: true, matched: addrMatch[1] ?? addrMatch[0] };
      const parts = String(addressRef.value).split(",");
      const last = parts[parts.length - 1].trim();
      if (parts.length >= 3) suburbRef = parts[parts.length - 2].trim();
      else suburbRef = last.replace(/\s*[A-Za-z]{2,3}\s*\d{4}\s*$/, "").trim() || null;
    }
  }
  const address = addressRef;
  let suburb = suburbRef;
  const suburbAlt = !suburb ? buf.match(/\b([A-Za-z][a-zA-Z ]{1,27})\s+(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s?\d{4}/) : null;
  suburb = suburb ?? (suburbAlt ? suburbAlt[1].trim() : null);

  // state: from the address snippet, else the URL path
  let state: StateCode | null = null;
  for (const [code, re] of STATE_HINTS) {
    if (re.test(address?.matched ?? buf.slice(0, 4000))) { state = code; break; }
  }
  if (!state && url) {
    const lower = url.toLowerCase();
    if (/\/(nsw|new-south-wales)\b|nsw/.test(lower)) state = "NSW";
    else if (/\/(vic|victoria)\b|vic/.test(lower)) state = "VIC";
    else if (/\/(qld|queensland)\b|qld/.test(lower)) state = "QLD";
    else if (/\/(wa|western-australia)\b|western-australia/.test(lower)) state = "WA";
    else if (/\/(sa|south-australia)\b/.test(lower)) state = "SA";
    else if (/\/(tas|tasmania)\b/.test(lower)) state = "TAS";
    else if (/\/(act);\b|australian-capital-territory/.test(lower)) state = "ACT";
    else if (/\/(nt|northern-territory)\b/.test(lower)) state = "NT";
  }

  // counts: canonical "4 beds" (digit before word) OR "Bedrooms: 4"/"Bedrooms 4"/"Bedrooms4" (word before digit)
  const COUNT_KWS = {
    beds: String.raw`bedrooms?|beds?|bds?`,
    baths: String.raw`bathrooms?|baths?|bths?`,
    cars: String.raw`car\s?spaces?|carspace|parking(?:\s+spaces?)?|garages?|cars?`,
  } as const;
  const countA = (kw: string) => new RegExp(String.raw`\b(\d{1,2}(?:\.\d)?)\s*(?:` + kw + String.raw`)\b`, "i");
  const countB = (kw: string) => new RegExp(String.raw`(?:` + kw + String.raw`)\s*[:|\-]?\s*(\d{1,2})\b`, "i");
  const pick = (kw: string): string | null => {
    for (const re of [countA(kw), countB(kw)]) {
      const m = buf.match(re);
      if (m) return m[1];
    }
    return null;
  };
  const bedsStr = pick(COUNT_KWS.beds);
  const bathsStr = pick(COUNT_KWS.baths);
  const carsStr = pick(COUNT_KWS.cars);
  void BOTH_ORDER_COUNTS;

  const typeWords = buf.match(/\b(house|townhouse|apartment|unit|villa|duplex|flat|land)\b/i);
  const newish = /\b(off the plan|new home|newly built|brand new|house and land|brand-new)\b/i.test(buf) || /new/.test(url);

  // region guess via the official regional centres list
  let regionGuess: "major" | "rest" | null = null;
  if (state && suburb) {
    const centres = REGIONAL_CENTRES[state] ?? [];
    const s = suburb.toLowerCase();
    regionGuess = centres.some((c) => s.includes(c.toLowerCase())) ? "major" : "rest";
  }

  const confident = (price != null) && (bedsStr != null || carsStr != null || address != null);
  const some = price != null || bedsStr != null || address != null;

  return {
    url,
    price: price
      ? { value: price.value, confident, matched: price.match }
      : { value: null, confident: false },
    address: address ?? { value: null, confident: false },
    suburb: { value: suburb, confident: Boolean(suburb) },
    beds: bedsStr ? { value: Number(bedsStr), confident: true, matched: bedsStr } : { value: null, confident: false },
    baths: bathsStr ? { value: Number(bathsStr), confident: true, matched: bathsStr } : { value: null, confident: false },
    cars: carsStr ? { value: Number(carsStr), confident: true, matched: carsStr } : { value: null, confident: false },
    homeContext: newish ? "new" : typeWords ? "existing" : null,
    state,
    regionGuess,
    confidence: confident ? "high" : some ? "medium" : "none",
    usedSnippet: buf.slice(0, 220).replace(/\s+/g, " "),
  };
}

export function appliedHomeType(guess: ListingGuess, fallback: "existing" | "new"): "existing" | "new" {
  if (guess.homeContext === "new") return "new";
  if (guess.homeContext === "existing") return "existing";
  return fallback;
}
