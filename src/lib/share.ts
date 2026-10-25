/**
 * Shareable scenarios: the whole input set travels in the URL hash, so a link needs no server.
 * Kept out of App so the round trip (including malformed and older links) can be unit tested.
 */

import { initialInputs, type Inputs } from "./engine";

export function encodeState(inputs: Inputs): string {
  const json = JSON.stringify(inputs);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeState(hash: string): Inputs | null {
  try {
    const b64 = hash.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64)));
    const partial = JSON.parse(json) as Partial<Inputs>;
    if (!partial || typeof partial !== "object") return null;
    return mergeInputs(partial);
  } catch {
    return null;
  }
}

/** Fills anything missing (older links, older saved state) from the defaults. */
export function mergeInputs(p: Partial<Inputs>): Inputs {
  return {
    ...initialInputs,
    ...p,
    buyback: { ...initialInputs.buyback, ...(p.buyback ?? {}) },
  };
}
