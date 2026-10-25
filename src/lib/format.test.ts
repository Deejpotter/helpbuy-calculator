import { describe, expect, it } from "vitest";
import { aud, clamp, moneyShort, num, num0, numPrec, parseMoney, parsePct, pct, roundTo } from "./format";

describe("money formatting", () => {
  it("formats whole dollars the Australian way", () => {
    expect(aud(450_000)).toBe("$450,000");
    expect(aud(0)).toBe("$0");
  });

  it("formats exact cents only when asked", () => {
    expect(aud(2_285.714, { exact: true })).toBe("$2,285.71");
    expect(aud(2_285.714)).toBe("$2,286");
  });

  it("formats numbers with a digit cap", () => {
    expect(num(1_234.567)).toBe("1,235");
    expect(num(1_234.567, 1)).toBe("1,234.6");
    expect(pct(0.16444)).toBe("16.4%");
    expect(pct(0.16444, 2)).toBe("16.44%");
  });

  it("keeps compact chart labels readable at every scale", () => {
    expect(moneyShort(481)).toBe("$481");
    expect(moneyShort(9_600)).toBe("$10k");
    expect(moneyShort(360_000)).toBe("$360k");
    expect(moneyShort(1_637_000)).toBe("$1.6M");
    expect(moneyShort(96_197_000)).toBe("$96.2M");
    expect(moneyShort(130_749_700_000)).toBe("$130.7B");
    expect(moneyShort(0)).toBe("$0");
    // negatives still read as money, without a doubled sign
    expect(moneyShort(-1_500_000)).toBe("-$1.5M");
  });
});

describe("parsing what people type", () => {
  it("reads money with symbols, commas and spaces", () => {
    expect(parseMoney("$650,000")).toBe(650_000);
    expect(parseMoney(" 450 000 ")).toBe(450_000);
    expect(parseMoney("0")).toBe(0);
  });

  it("never returns NaN, so a stray keystroke cannot break the maths", () => {
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("abc")).toBe(0);
    expect(parseMoney("$$$")).toBe(0);
    expect(parsePct("%")).toBe(0);
    expect(parsePct("junk")).toBe(0);
  });

  it("reads percentages with or without the sign", () => {
    expect(parsePct("6.55%")).toBe(6.55);
    expect(parsePct("6.55")).toBe(6.55);
    expect(parsePct(" 7 %")).toBe(7);
  });
});

describe("small numeric helpers", () => {
  it("clamps inside the bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("rounds to the nearest step", () => {
    expect(roundTo(44_400, 1_000)).toBe(44_000);
    expect(roundTo(44_600, 1_000)).toBe(45_000);
    expect(roundTo(44_500, 1_000)).toBe(45_000);
  });

  it("renders safe text for non-finite numbers", () => {
    expect(num0(Number.NaN)).toBe("0");
    expect(num0(Number.POSITIVE_INFINITY)).toBe("0");
    expect(numPrec(Number.NaN)).toBe("0");
    expect(numPrec(Number.POSITIVE_INFINITY)).toBe("0");
    expect(numPrec(1.005)).toBe("1");
    expect(numPrec(1.23456, 3)).toBe("1.235");
  });
});
