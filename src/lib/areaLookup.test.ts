import { describe, expect, it } from "vitest";
import { areaCount, generatedOn, lookupArea, capFor } from "./areaLookup";

describe("areaLookup (bundled official snapshot)", () => {
  it("has the full official index and a generation date", () => {
    expect(areaCount()).toBe(5230);
    expect(generatedOn()).toBe("2026-10-23");
  });

  it("matches postcodes exactly, across states when shared", () => {
    const r = lookupArea("3121"); // Burnley, Cremorne and Richmond share 3121 in VIC
    expect(r.length).toBe(3);
    const richmond = r.find((m) => m.suburb === "RICHMOND")!;
    expect(richmond.state).toBe("VIC");
    expect(richmond.cap).toBe(950_000);
    expect(richmond.region).toBe("major");
  });

  it("matches suburbs by exact name, case-insensitively", () => {
    const g = lookupArea("frankston north");
    expect(g[0].suburb).toBe("FRANKSTON NORTH");
    expect(g[0].state).toBe("VIC");
    expect(g[0].postcode).toBe("3200");
    // Frankston is outer Melbourne: the official tool gives it the metro cap
    expect(g[0].cap).toBe(950_000);
  });

  it("prefix and contains matches work for partial suburb names", () => {
    const p = lookupArea("BELL P"); // BELL PARK and BELL POST HILL (VIC)
    expect(p.length).toBe(2);
    expect(p.every((m) => m.suburb.startsWith("BELL P"))).toBe(true);
    // an exact locality name wins over prefixes
    const bell = lookupArea("BELL"); // Bell NSW 2786 exists
    expect(bell[0].suburb).toBe("BELL");
    expect(bell[0].state).toBe("NSW");
  });

  it("a miss simply means rest-of-state (default), not an error", () => {
    expect(lookupArea("zzzzzz")).toHaveLength(0);
    // any locality not in the major snapshot gets the rest cap
    expect(capFor("VIC", "rest")).toBe(650_000);
  });

  it("ACT and NT entries carry their flat caps", () => {
    const act = lookupArea("BRADDON");
    expect(act[0]?.state).toBe("ACT");
    expect(act[0]?.cap).toBe(1_000_000);
    const nt = lookupArea("PARAP");
    expect(nt[0]?.state).toBe("NT");
    expect(nt[0]?.cap).toBe(600_000);
  });
});
