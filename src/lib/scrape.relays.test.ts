import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SiteBlockedError,
  appliedHomeType,
  fetchListingText,
  normalizeUrl,
  parseListingText,
  siteLabel,
} from "./scrape";

describe("URL handling", () => {
  it("keeps good URLs as they are and rejects the rest", () => {
    expect(normalizeUrl("https://www.domain.com.au/1-2-3")).toBe("https://www.domain.com.au/1-2-3");
    expect(normalizeUrl("  domain.com.au/x?y=1  ")).toBe("https://domain.com.au/x?y=1");
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl("   ")).toBe("");
    expect(normalizeUrl("localhost")).toBe("");
    expect(normalizeUrl("hello world")).toBe("");
  });

  it("names the site for the error message", () => {
    expect(siteLabel("https://www.realestate.com.au/x")).toBe("realestate.com.au");
    expect(siteLabel("https://www.domain.com.au/x")).toBe("domain.com.au");
    expect(siteLabel("https://www.homely.com.au/x")).toBe("Homely");
    expect(siteLabel("https://www.example.net/x")).toBe("example.net");
    expect(siteLabel("not a url")).toBe("the site");
  });
});

describe("reading a listing through the relays", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  const stub = (impl: (url: string) => Promise<Response> | Response) => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => impl(String(url))) as unknown as typeof fetch);
  };

  it("uses the reader relay when it returns real text", async () => {
    stub((url) =>
      url.startsWith("https://r.jina.ai/")
        ? new Response("A long listing page. ".repeat(30), { status: 200 })
        : new Response("nope", { status: 500 }),
    );
    const out = await fetchListingText("https://example.com/listing");
    expect(out.via).toBe("jina");
    expect(out.text.length).toBeGreaterThan(300);
  });

  it("raises SiteBlockedError with the site's name when the reader hits a wall", async () => {
    stub(() => new Response("Access Denied. captcha required. ".repeat(10), { status: 200 }));
    await expect(fetchListingText("https://www.realestate.com.au/x")).rejects.toBeInstanceOf(SiteBlockedError);
    try {
      await fetchListingText("https://www.realestate.com.au/x");
    } catch (e) {
      expect((e as SiteBlockedError).site).toBe("realestate.com.au");
      expect((e as SiteBlockedError).url).toBe("https://www.realestate.com.au/x");
      expect((e as Error).message).toMatch(/blocks automated readers/i);
    }
  });

  it("falls back to the second relay when the first fails", async () => {
    stub((url) => {
      if (url.startsWith("https://r.jina.ai/")) return new Response("too short", { status: 200 });
      return new Response("<html>a real listing body</html> ".repeat(20), { status: 200 });
    });
    const out = await fetchListingText("https://example.com/listing");
    expect(out.via).toBe("allorigins");
  });

  it("gives one clear message when both relays fail", async () => {
    stub(() => new Response("", { status: 502 }));
    await expect(fetchListingText("https://example.com/listing")).rejects.toThrow(/Couldn't read that listing/);
  });

  it("detects a wall on the fallback relay too", async () => {
    stub((url) => {
      if (url.startsWith("https://r.jina.ai/")) return new Response("short", { status: 200 });
      return new Response("Attention Required! Cloudflare. Pardon our interruption. ".repeat(20), { status: 200 });
    });
    await expect(fetchListingText("https://www.domain.com.au/x")).rejects.toBeInstanceOf(SiteBlockedError);
  });
});

describe("parsing the important shapes", () => {
  it("ignores a weekly rent and takes the sale price instead", () => {
    const text = "12 Green St, Richmond VIC 3121\n$650 per week\nRent $650 pw\nSale price $1,150,000\n3 beds 1 bath";
    const g = parseListingText(text, "manual");
    expect(g.price.value).toBe(1_150_000);
  });

  it("takes the first number from a price guide range", () => {
    const g = parseListingText("45 Spencer St, Melbourne VIC 3000\nOffers over $780,000\n2 beds 1 bath", "manual");
    expect(g.price.value).toBe(780_000);
  });

  it("ignores absurd amounts (rent per annum and typos)", () => {
    const g = parseListingText("Deposit $50,000\nRent $95,000 per annum\n9 beds", "manual");
    // $50,000 is under the $75,000 floor; the annual rent is filtered as rent-ish
    expect(g.price.value).toBeNull();
  });

  it("falls back to the URL for the state when the text has none", () => {
    const g = parseListingText("A lovely 3 bed home with a big yard.", "https://www.domain.com.au/3-bed-house-qld-brisbane-1");
    expect(g.state).toBe("QLD");
    expect(g.beds.value).toBe(3);
  });

  it("guesses the region from the official regional centre list", () => {
    const geelong = parseListingText("22 Pakington St, Geelong VIC 3220\n$850,000\n3 beds", "manual");
    expect(geelong.state).toBe("VIC");
    expect(geelong.regionGuess).toBe("major");

    const ballarat = parseListingText("22 Sturt St, Ballarat VIC 3350\n$650,000\n3 beds", "manual");
    expect(ballarat.regionGuess).toBe("rest");
  });

  it("leaves the region alone when the state or suburb is unknown", () => {
    const g = parseListingText("A nice house with four bedrooms and a pool.", "manual");
    expect(g.regionGuess).toBeNull();
  });

  it("treats a bare house as existing and off-the-plan as new", () => {
    expect(parseListingText("$900,000\n4 beds\nHouse", "manual").homeContext).toBe("existing");
    expect(parseListingText("$900,000\nBrand new townhouse\n4 beds", "manual").homeContext).toBe("new");
    expect(parseListingText("$900,000\n4 beds", "manual").homeContext).toBeNull();
  });

  it("says how confident it is, so the UI can stay cautious", () => {
    const strong = parseListingText("12 Green St, Richmond VIC 3121\n$1,150,000\n4 beds", "manual");
    expect(strong.confidence).toBe("high");
    const partial = parseListingText("$1,150,000", "manual");
    expect(partial.confidence).toBe("medium");
    const nothing = parseListingText("just some words", "manual");
    expect(nothing.confidence).toBe("none");
  });

  it("keeps the home type fallback when the text says nothing", () => {
    expect(appliedHomeType(parseListingText("$900,000\nBrand new home", "manual"), "existing")).toBe("new");
    expect(appliedHomeType(parseListingText("$900,000\nHouse", "manual"), "new")).toBe("existing");
    expect(appliedHomeType(parseListingText("$900,000", "manual"), "new")).toBe("new");
  });
});
