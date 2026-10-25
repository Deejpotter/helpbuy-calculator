import { describe, expect, it } from "vitest";
import { DUTY_ESTIMATE_NOTE, roughDuty } from "./duty";
import { PRICE_CAPS, SX, type StateCode } from "./constants";

const STATES: StateCode[] = Object.keys(SX) as StateCode[];

describe("transfer duty estimates", () => {
  it("has a scale for every state with a cap, and returns null for the territories", () => {
    expect(roughDuty("JBT", 500_000)).toBeNull();
    expect(roughDuty("CXCK", 500_000)).toBeNull();
    for (const s of STATES.filter((x) => x !== "JBT" && x !== "CXCK")) {
      expect(roughDuty(s, 500_000)).not.toBeNull();
    }
  });

  it("charges nothing at zero and never goes down as the value rises", () => {
    for (const s of STATES) {
      const zero = roughDuty(s, 0);
      if (zero !== null) expect(zero).toBe(0); // territories return null: no scale
      let last = -1;
      for (const v of [50_000, 250_000, 500_000, 900_000, 1_500_000]) {
        const d = roughDuty(s, v) ?? 0;
        expect(d).toBeGreaterThanOrEqual(last);
        last = d;
      }
    }
  });

  it("rounds to the nearest $10 and matches the Victorian scale at a known value", () => {
    // VIC: $3,290 + 6% of the value above $130,000
    expect(roughDuty("VIC", 600_000)).toBe(31_490);
    expect(roughDuty("VIC", 600_000)! % 10).toBe(0);
    // a 30% share of a $450,000 home is what the app actually asks for
    expect(roughDuty("VIC", 135_000)).toBe(3_590);
  });

  it("matches the New South Wales band boundaries", () => {
    expect(roughDuty("NSW", 17_000)).toBe(210); // 1.25% capped at the band, rounded to $10
    expect(roughDuty("NSW", 400_000)).toBe(14_460); // 2,613 + 4.23% above $120,000
  });

  it("treats negative values as zero rather than charging a negative duty", () => {
    expect(roughDuty("VIC", -50_000)).toBe(0);
  });

  it("ships the wording that warns it is only an estimate", () => {
    expect(DUTY_ESTIMATE_NOTE).toMatch(/estimate/i);
    expect(DUTY_ESTIMATE_NOTE).toMatch(/concession/i);
  });
});

describe("price caps table", () => {
  it("has an entry for every state code", () => {
    for (const s of STATES) expect(PRICE_CAPS[s]).toBeDefined();
  });

  it("uses null where a region has no separate cap", () => {
    expect(PRICE_CAPS.ACT.major).toBe(1_000_000);
    expect(PRICE_CAPS.ACT.rest).toBeNull();
    expect(PRICE_CAPS.JBT.major).toBeNull();
    expect(PRICE_CAPS.NT.major).toBe(PRICE_CAPS.NT.rest);
  });

  it("never lets a rest-of-state cap exceed the capital city cap", () => {
    for (const s of STATES) {
      const { major, rest } = PRICE_CAPS[s];
      if (major !== null && rest !== null) expect(rest).toBeLessThanOrEqual(major);
    }
  });
});
