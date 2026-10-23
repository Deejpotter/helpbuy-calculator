/**
 * Suburb / postcode to price-cap lookup, built from the bundled official snapshot.
 * No network needed at runtime: the data was extracted from the scheme's own postcode
 * tool (see scripts/extract-caps.ps1 and the GENERAGED_ON date in areaData.ts).
 */

import { PRICE_CAPS, SX, type StateCode } from "./constants";
import { GENERATED_ON, MAJOR_LOCALITIES } from "./areaData";

export type AreaMatch = {
  suburb: string;
  postcode: string;
  state: StateCode;
  cap: number;
  region: "major" | "rest";
};

type Entry = { suburb: string; postcode: string; state: StateCode; region: "major" | "rest"; cap: number };

let index: Entry[] | null = null;

function stateOf(token: string): StateCode | null {
  switch (token) {
    case "NSW": case "VIC": case "QLD": case "WA": case "SA":
    case "TAS": case "ACT": case "NT":
      return token as StateCode;
    default:
      return null;
  }
}

function buildIndex(): Entry[] {
  if (index) return index;
  const all: Entry[] = [];
  for (const [stateToken, blob] of Object.entries(MAJOR_LOCALITIES)) {
    const state = stateOf(stateToken);
    if (!state) continue;
    if (!blob) continue;
    const majorCap = PRICE_CAPS[state].major;
    for (const pair of blob.split(";")) {
      const [suburb, postcode] = pair.split("|");
      if (!suburb || !postcode) continue;
      all.push({
        suburb,
        postcode,
        state,
        region: "major",
        cap: majorCap ?? Number.NaN,
      });
    }
  }
  index = all;
  return all;
}

export function generatedOn(): string {
  return GENERATED_ON;
}

export function areaCount(): number {
  return buildIndex().length;
}

/**
 * Look up a suburb or postcode. A 4-digit query matches postcodes exactly; otherwise the
 * query is a suburb name match (exact first, then prefix, then contains). Results are capped
 * to keep the UI tidy. Only major-class localities are indexed; a miss means "rest of state"
 * (the default) rather than an error.
 */
export function lookupArea(query: string): AreaMatch[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const all = buildIndex();

  const postcode = /^(\d{4})$/.exec(q);
  if (postcode) {
    return all
      .filter((e) => e.postcode === postcode[1])
      .slice(0, 8);
  }

  const exact = all.filter((e) => e.suburb === q);
  if (exact.length) return exact.slice(0, 8);
  const prefix = all.filter((e) => e.suburb.startsWith(q));
  if (prefix.length) return prefix.slice(0, 8);
  return all.filter((e) => e.suburb.includes(q)).slice(0, 8);
}

/** The cap for a state + region pair (from the official table in constants). */
export function capFor(state: StateCode, region: "major" | "rest"): number | null {
  const caps = PRICE_CAPS[state];
  return region === "major" ? caps.major : caps.rest;
}

export const AREA_NOTE = `Area lookup bundled ${GENERATED_ON} from the official postcode tool. Localities not found are "rest of state" by default; verify a tricky suburb on the official tool if the price is close to a cap.`;
