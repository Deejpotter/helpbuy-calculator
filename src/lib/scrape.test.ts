import { describe, expect, it } from "vitest";
import { normalizeUrl, parseListingText } from "./scrape";

const REA_TEXT = `
12 Green St
Richmond VIC 3121
$1,150,000 - $1,245,000
4 beds 2 baths 2 car
House
A rare opportunity in the heart of Richmond…
Image supplied by the agent.
`;

const DOMAIN_TEXT = `
Off the plan apartment at 45 Spencer St, Melbourne VIC 3000.
Price guide $780,000. 2 beds, 1 bath, 1 car parking space.
`;

describe("normalizeUrl", () => {
  it("adds https and validates host", () => {
    expect(normalizeUrl("realestate.com.au/property-house-vic-richmond-1")).toBe(
      "https://realestate.com.au/property-house-vic-richmond-1",
    );
    expect(normalizeUrl("not a url")).toBe("");
  });
});

describe("parseListingText", () => {
  it("extracts price, address, beds, type and state from a typical REA page", () => {
    const g = parseListingText(REA_TEXT, "https://realestate.com.au/property-house-vic-richmond-1");
    expect(g.price.value).toBe(1_150_000);
    expect(g.beds.value).toBe(4);
    expect(g.baths.value).toBe(2);
    expect(g.cars.value).toBe(2);
    expect(g.state).toBe("VIC");
    expect(g.homeContext).toBe("existing");
    expect(["high", "medium"]).toContain(g.confidence);
    expect(g.suburb.value).toBe("Richmond");
  });

  it("understands keyword-first counts like 'Bedrooms: 4' and street-type addresses", () => {
    const g = parseListingText(
      "152 Caseys Road, Frankston North VIC 3200 - House for Sale\nGuide Price $640,000 - $670,000\nBedrooms: 4 | Bathrooms: 2 | Car Spaces: 3",
      "manual",
    );
    expect(g.price.value).toBe(640_000);
    expect(g.beds.value).toBe(4);
    expect(g.baths.value).toBe(2);
    expect(g.cars.value).toBe(3);
    expect(String(g.address.value)).toContain("Frankston North");
    expect(g.state).toBe("VIC");
  });

  it("recognises a bot-wall page instead of pretending to parse junk", () => {
    const wall = "Access Denied\n\nYou don't have permission to access this server.\nReference #18.edgesuite";
    const g = parseListingText(wall, "https://www.realestate.com.au/property-house-vic-x-1");
    expect(g.confidence).toBe("none");
    void wall;
  });

  it("marks an off-the-plan apartment as new", () => {
    const g = parseListingText(DOMAIN_TEXT, "https://domain.com.au/property-apartment-vic-melbourne-2");
    expect(g.homeContext).toBe("new");
    expect(g.price.value).toBe(780_000);
    expect(g.beds.value).toBe(2);
  });

  it("never crashes on junk text (low confidence, no throws)", () => {
    const g = parseListingText("catty content only", "");
    expect(g.price.value).toBe(null);
    expect(g.confidence).toBe("none");
  });
});
