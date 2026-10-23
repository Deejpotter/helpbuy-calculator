/**
 * Property listing import. Australian listing sites (realestate.com.au, domain.com.au, ...)
 * block direct browser fetches (CORS + bot walls), so we fetch through the r.jina.ai reader
 * proxy, which returns plain text of the page. If that fails or is blocked, the UI offers a
 * paste-the-text fallback. Every parsed field stays editable — never auto-final.
 */

import { REGIONAL_CENTRES, type StateCode } from "./constants";

export type ListingField = {
  value: number | string | null;
  confident: boolean;
  matched?: string;
};

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

/** Fetch page text via the reader proxy. Throws with a human explanation on failure. */
export async function fetchListingText(url: string): Promise<string> {
  const viaProxy = `https://r.jina.ai/${url}`;
  try {
    const res = await fetch(viaProxy, { headers: { Accept: "text/plain" } });
    if (res.ok) {
      const text = await res.text();
      if (text.trim().length > 80) return text;
    }
  } catch {
    /* fall through to manual fallback */
  }
  throw new Error(
    "Couldn't read that listing (the site may block importing). Use “Paste the listing text instead”.",
  );
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

export function parseListingText(text: string, url: string): ListingGuess {
  const buf = text.slice(0, 40_000); // regex over the head of the doc is plenty

  // price: collect $-like amounts, prefer the first plausible one (≥ 75k), ignore $pw rent-ish
  const priceMatches = [...buf.matchAll(/\$\s?([\d][\d,]{4,11})/g)].map((m) => ({
    match: m[0],
    value: Number(m[1].replace(/,/g, "")),
    index: m.index ?? 0,
  })).filter((p) => p.value >= 75_000 && p.value <= 20_000_000);
  const rential = /\/\s?(week|wk|pw|month|annum)\b/i;
  const price =
    priceMatches.filter((p) => !rential.test(buf.slice(p.index, p.index + 30)))[0] ?? null;

  // address: look for "…, SUBURB STATE ####" first; else the snippet title
  const addrMatch =
    buf.match(/([0-9]{1,3}[A-Za-z]?\/?[^\n|,]{4,60},\s?[^\n|,]{2,40},?\s+(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s?\d{4})/) ??
    buf.match(/([0-9]{1,3}[A-Za-z]?\/?[^\n|,]{4,60},\s?(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\s?\d{4})/);
  let address = addrMatch ? { value: addrMatch[0].trim(), confident: true, matched: addrMatch[0] } : null;

  // suburb from the address, else "Suburb, STATE ####" pattern
  let suburb: string | null = null;
  if (address) {
    const parts = String(address.value).split(",");
    const last = parts[parts.length - 1].trim();
    if (parts.length >= 3) suburb = parts[parts.length - 2].trim();
    else suburb = last.replace(/\s*[A-Za-z]{2,3}\s*\d{4}\s*$/, "").trim() || null;
  }
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

  const bedM = buf.match(/\b(\d{1,2})\s*[\.\d]*\s*(?:bed|bedroom)/i);
  const bathM = buf.match(/\b(\d{1,2})\s*[\.\d]*\s*(?:bath|bathroom)/i);
  const carM = buf.match(/\b(\d{1,2})\s*[\.\d]*\s*(?:parking|garage|car space|carspace|car)/i);

  const typeWords = buf.match(/\b(house|townhouse|apartment|unit|villa|duplex|flat|land)\b/i);
  const newish = /\b(off the plan|new home|newly built|brand new|house and land|brand-new)\b/i.test(buf) || /new/.test(url);

  // region guess via the official regional centres list
  let regionGuess: "major" | "rest" | null = null;
  if (state && suburb) {
    const centres = REGIONAL_CENTRES[state] ?? [];
    const s = suburb.toLowerCase();
    regionGuess = centres.some((c) => s.includes(c.toLowerCase())) ? "major" : "rest";
  }

  const confident = (price != null) && (bedM != null || carM != null || address != null);
  const some = price != null || bedM != null || address != null;

  return {
    url,
    price: price
      ? { value: price.value, confident, matched: price.match }
      : { value: null, confident: false },
    address: address ?? { value: null, confident: false },
    suburb: { value: suburb, confident: Boolean(suburb) },
    beds: bedM ? { value: Number(bedM[1]), confident: true, matched: bedM[0] } : { value: null, confident: false },
    baths: bathM ? { value: Number(bathM[1]), confident: true, matched: bathM[0] } : { value: null, confident: false },
    cars: carM ? { value: Number(carM[1]), confident: true, matched: carM[0] } : { value: null, confident: false },
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
