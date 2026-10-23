import { useState } from "react";
import { aud } from "../lib/format";
import {
  fetchListingText,
  normalizeUrl,
  parseListingText,
  siteLabel,
  type ListingGuess,
  type SiteBlockedError,
} from "../lib/scrape";

type ListingPatch = Partial<import("../lib/engine").Inputs>;

/** Paste-a-listing-URL import: fetches via reader relay, parses, produces editable prefill.
 *  Welcomes blocked sites with an honest, per-site message and an immediate paste path. */
export default function ListingImport(props: { onApply: (patch: ListingPatch) => void }) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "error" | "blocked" | "done">("idle");
  const [message, setMessage] = useState("");
  const [guess, setGuess] = useState<ListingGuess | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [paste, setPaste] = useState("");

  const apply = (g: ListingGuess) => {
    const patch: ListingPatch = {};
    if (g.price.value) patch.homeValue = g.price.value;
    if (g.state) patch.state = g.state;
    if (g.regionGuess) patch.region = g.regionGuess;
    if (g.homeContext) patch.homeType = g.homeContext;
    props.onApply(patch);
  };

  const digest = (g: ListingGuess) => {
    const bits: string[] = [];
    if (g.price.value) bits.push(aud(g.price.value));
    if (g.state) bits.push(g.state);
    if (g.beds.value) bits.push(`${g.beds.value} bed`);
    if (g.cars.value) bits.push(`${g.cars.value} car`);
    return bits.join(" · ") || "";
  };

  async function run(raw: string) {
    const u = normalizeUrl(raw);
    if (!u) {
      setPhase("error");
      setMessage("That doesn't look like a link.");
      return;
    }
    setUrl(u);
    setPhase("loading");
    setMessage("");
    try {
      const { text } = await fetchListingText(u);
      const g = parseListingText(text, u);
      setGuess(g);
      if (g.confidence === "none") {
        setPhase("error");
        setPasteMode(true);
        setMessage("Read the page, but couldn't spot a price, beds or an address. Check the fields below or paste the text.");
      } else {
        setPhase("done");
        setMessage(`Imported: ${digest(g)}. Everything below stays editable.`);
        apply(g);
      }
    } catch (e) {
      setPasteMode(true);
      if ((e as SiteBlockedError).name === "SiteBlockedError") {
        const site = siteLabel(u);
        setPhase("blocked");
        setMessage(
          `${site} deliberately blocks automated readers (a bot wall) — no importer can get through honestly. ` +
          "Copy the top of the listing instead: address line, price, beds/baths/cars — then press Parse below.",
        );
      } else {
        setPhase("error");
        setMessage(e instanceof Error ? e.message : "Fetch failed.");
      }
    }
  }

  function parsePasted() {
    const g = parseListingText(paste, url || "manual");
    setGuess(g);
    if (g.confidence === "none") {
      setPhase("error");
      setMessage("Parsed, but nothing matched. You can still type the fields manually below — fastest is just the price.");
    } else {
      setPhase("done");
      setMessage(`Imported: ${digest(g)}. Everything below stays editable.`);
      apply(g);
    }
  }

  return (
    <div className="import">
      <div className="import-row">
        <input
          className="tinput url"
          type="url"
          placeholder="Paste a listing link (realestate.com.au, domain.com.au, homely, openhome…) — or skip straight to paste"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(url)}
          aria-label="Listing URL"
        />
        <button className={"btn solid" + (phase === "loading" ? " loading" : "")} onClick={() => run(url)} disabled={phase === "loading"}>
          {phase === "loading" ? "Reading…" : "Read listing"}
        </button>
      </div>
      {message ? (
        <p className={"import-note " + (phase === "error" ? "warn" : phase === "blocked" ? "warn" : "ok")}>
          {message}
          {phase === "blocked" && url ? (
            <>
              <br />
              <a href={url} target="_blank" rel="noopener noreferrer" className="mini-link">Open the listing ↗</a>
              {" "}<span className="muted">— copy the overview (address, price, beds/baths/cars), paste below.</span>
            </>
          ) : null}
        </p>
      ) : null}
      {guess && guess.confidence !== "none" ? (
        <p className="import-fields">
          {[
            guess.price.matched,
            guess.address.value,
            [guess.beds.value && `${guess.beds.value} bed`, guess.baths.value && `${guess.baths.value} bath`, guess.cars.value && `${guess.cars.value} car`].filter(Boolean).join(" · "),
          ].filter(Boolean).join(" — ")}
        </p>
      ) : null}
      {pasteMode ? (
        <details className="import-paste" open>
          <summary>Paste the listing text instead — works with every site</summary>
          <textarea
            className="tinput"
            rows={6}
            placeholder={"e.g.\n152 Caseys Road, Frankston North VIC 3200\nGuide Price $640,000 - $670,000\n4 Bedrooms / 2 Bathrooms / 3 Car Spaces"}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button className="btn solid" onClick={parsePasted}>Parse pasted text</button>
        </details>
      ) : null}
    </div>
  );
}
