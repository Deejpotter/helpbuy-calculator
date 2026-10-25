import { describe, expect, it } from "vitest";
import { initialInputs, type Inputs } from "./engine";
import { decodeState, encodeState, mergeInputs } from "./share";

const scenario = (over: Partial<Inputs> = {}): Inputs => ({ ...initialInputs, ...over });

describe("share links", () => {
  it("round trips a full scenario without losing a field", () => {
    const inp = scenario({
      state: "VIC",
      homeValue: 450_000,
      deposit: 16_000,
      maxLoan: 456_441,
      ratePct: 6.1,
      growthPct: 5.5,
      buyback: { enabled: true, startYear: 3, percentPerYear: 7.5, everyYears: 1, loanTermYears: 0, fundByLoan: true },
      improvement: { year: 4, cost: 30_000, valueUplift: 35_000 },
      sellAfterYear: 12,
    });
    const decoded = decodeState(encodeState(inp));
    expect(decoded).toEqual(inp);
  });

  it("produces a URL-safe string (no +, /, = or spaces)", () => {
    // unicode and slashes in the payload must survive the trip
    const code = encodeState(scenario({ state: "VIC" }));
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeState(code)!.state).toBe("VIC");
  });

  it("returns null for junk instead of throwing", () => {
    expect(decodeState("")).toBeNull();
    expect(decodeState("not-base64!!")).toBeNull();
    expect(decodeState("%%%")).toBeNull();
    // valid base64 that isn't the object we expect
    expect(decodeState(btoa("42"))).toBeNull();
    expect(decodeState(btoa("null"))).toBeNull();
    expect(decodeState(btoa('"a string"'))).toBeNull();
  });

  it("fills fields that an older link didn't have", () => {
    const decoded = decodeState(encodeState({ homeValue: 500_000 } as Inputs));
    expect(decoded).not.toBeNull();
    expect(decoded!.homeValue).toBe(500_000);
    // everything else comes from the defaults, including the nested buy-back plan
    expect(decoded!.deposit).toBe(initialInputs.deposit);
    expect(decoded!.buyback).toEqual(initialInputs.buyback);
    expect(decoded!.buyback.fundByLoan).toBe(true);
  });

  it("merges a partial buy-back without dropping its other settings", () => {
    const merged = mergeInputs({ buyback: { enabled: true } as Inputs["buyback"] });
    expect(merged.buyback.enabled).toBe(true);
    expect(merged.buyback.startYear).toBe(initialInputs.buyback.startYear);
    expect(merged.buyback.percentPerYear).toBe(initialInputs.buyback.percentPerYear);
    expect(merged.buyback.fundByLoan).toBe(initialInputs.buyback.fundByLoan);
  });
});
