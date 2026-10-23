/**
 * Transfer (stamp) duty estimates on the BUYER'S SHARE of the property.
 *
 * IMPORTANT — every table below is a rough estimate "as at" the date in the comment and
 * treats Home to Buy the way most state SROs treat shared-equity purchases: duty payable
 * on your share, not the whole value. Some states understate/overstate concessions for the
 * federal scheme; first home buyer concessions often zero or reduce it further.
 *
 * ALWAYS verify with your state's calculator (SRO_LINKS) and have your conveyancer
 * confirm, or enter the exact amount in the app. The app flags these as estimates.
 */

import type { StateCode } from "./constants";

type Band = { upTo: number; /** flat $ base at start of band */ base: number; /** $ per $100 marginal */ marginal: number };

type Scale = { bands: Band[]; asAt: string };

// General residential transfer duty scales (rounded). FHB concessions NOT baked in.
const NSW: Scale = {
  asAt: "2025",
  bands: [
    { upTo: 17_000, base: 0, marginal: 1.25 },
    { upTo: 37_000, base: 212, marginal: 2.5 },
    { upTo: 99_000, base: 712, marginal: 2.24 },
    { upTo: 120_000, base: 2_109, marginal: 2.4 },
    { upTo: 400_000, base: 2_613, marginal: 4.23 },
    { upTo: 440_000, base: 15_338, marginal: 4.4 },
    { upTo: 722_000, base: 32_958, marginal: 4.5 },
    { upTo: 3_428_000, base: 59_848, marginal: 5.5 },
    { upTo: Infinity, base: 219_382, marginal: 7 },
  ],
};
const VIC: Scale = {
  asAt: "2025",
  bands: [
    { upTo: 25_000, base: 0, marginal: 1.4 },
    { upTo: 130_000, base: 350, marginal: 2.8 },
    { upTo: 960_000, base: 3_290, marginal: 6 },
    { upTo: 1_000_000, base: 53_090, marginal: 6.5 },
    { upTo: Infinity, base: 79_090, marginal: 5.5 },
  ],
};
const QLD: Scale = {
  asAt: "2024-25",
  bands: [
    { upTo: 5_000, base: 0, marginal: 0 },
    { upTo: 75_000, base: 0, marginal: 1.5 },
    { upTo: 540_000, base: 1_050, marginal: 3.5 },
    { upTo: 1_000_000, base: 17_325, marginal: 4.5 },
    { upTo: Infinity, base: 38_025, marginal: 5.25 },
  ],
};
const WA: Scale = {
  asAt: "2025",
  bands: [
    { upTo: 120_000, base: 0, marginal: 1.9 },
    { upTo: 150_000, base: 2_280, marginal: 2.85 },
    { upTo: 360_000, base: 3_135, marginal: 3.8 },
    { upTo: 725_000, base: 11_115, marginal: 4.75 },
    { upTo: Infinity, base: 28_453, marginal: 5.15 },
  ],
};
const SA: Scale = {
  asAt: "2025",
  bands: [
    { upTo: 12_000, base: 0, marginal: 1 },
    { upTo: 30_000, base: 120, marginal: 2 },
    { upTo: 50_000, base: 480, marginal: 3 },
    { upTo: 100_000, base: 1_080, marginal: 3.5 },
    { upTo: 200_000, base: 2_830, marginal: 4 },
    { upTo: 250_000, base: 6_830, marginal: 4.25 },
    { upTo: 300_000, base: 8_955, marginal: 4.75 },
    { upTo: 500_000, base: 11_330, marginal: 5 },
    { upTo: Infinity, base: 21_330, marginal: 5.5 },
  ],
};
const ACT: Scale = {
  asAt: "2025-26",
  bands: [
    { upTo: 200_000, base: 0, marginal: 1.69 },
    { upTo: 300_000, base: 3_378, marginal: 2.2 },
    { upTo: 500_000, base: 5_578, marginal: 3.54 },
    { upTo: 750_000, base: 12_658, marginal: 4.54 },
    { upTo: 1_000_000, base: 24_008, marginal: 5.82 },
    { upTo: 1_180_000, base: 38_558, marginal: 6.4 },
    { upTo: Infinity, base: 50_070, marginal: 6.8 },
  ],
};
const TAS: Scale = {
  asAt: "2025",
  bands: [
    { upTo: 3_000, base: 50, marginal: 1.25 },
    { upTo: 25_000, base: 88, marginal: 1.75 },
    { upTo: 75_000, base: 473, marginal: 2.25 },
    { upTo: 125_000, base: 1_598, marginal: 3.5 },
    { upTo: 200_000, base: 3_348, marginal: 4 },
    { upTo: 400_000, base: 6_348, marginal: 4.25 },
    { upTo: 750_000, base: 14_848, marginal: 4.5 },
    { upTo: Infinity, base: 30_598, marginal: 4.5 },
  ],
};
const NT: Scale = {
  asAt: "2025",
  bands: [
    { upTo: 525_000, base: 0, marginal: 0 },
    { upTo: 3_000_000, base: 0, marginal: 5.53 },
    { upTo: 5_000_000, base: 137_010, marginal: 5.75 },
    { upTo: Infinity, base: 252_010, marginal: 5.95 },
  ],
};

const SCALES: Partial<Record<StateCode, Scale>> = {
  NSW, VIC, QLD, WA, SA, ACT, TAS, NT,
};

/**
 * Rough duty on a value. For Help to Buy we call this with the buyer's share of the
 * property value. Returns null when no scale is available (JBT / territories).
 */
export function roughDuty(state: StateCode, taxableValue: number): number | null {
  const scale = SCALES[state];
  if (!scale) return null;
  const v = Math.max(0, taxableValue);
  if (v === 0) return 0;
  let prev = 0;
  for (const b of scale.bands) {
    if (v <= b.upTo) return Math.round((b.base + ((v - prev) / 100) * b.marginal) / 10) * 10;
    prev = b.upTo;
  }
  return null;
}

export const DUTY_ESTIMATE_NOTE =
  "Rough duty estimate on your share of the value at the scales noted. First home buyer concessions and shared-equity rules differ by state — verify on your state revenue office calculator, or enter the exact amount.";
