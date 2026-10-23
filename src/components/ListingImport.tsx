import { useState } from "react";
import { fetchListingText, normalizeUrl, parseListingText, type ListingGuess } from "../lib/scrape";
import { aud } from "../lib/format";

/** Paste-a-listing-URL import: fetches via reader proxy, parses, and produces editable prefill. */
export default function ListingImport(props: { onApply: (patch: Partial<import("../lib/engine").Inputs>) => void }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [message, setMessage] = useState<string>("");
  const [guess, setGuess] = useState<ListingGuess | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [paste, setPaste] = useState("");

  async function run(raw: string) {
    const u = normalizeUrl(raw);
    if (!u) {
      setState("error");
      setMessage("That doesn't look like a link.");
      return;
    }
    setUrl(u);
    try {
      setState("loading");
      setMessage("");
      const text = await fetchListingText(u);
      const g = parseListingText(text, u);
      setGuess(g);
      if (g.confidence === "none") {
        setState("error");
        setMessage("Read the page, but couldn't spot price, beds or an address — check the fields below or paste the text.");
      } else {
        setState("done");
        setMessage(previewMessage(g));
        apply(g);
      }
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Fetch failed.");
      setPasteMode(true);
    }
  }

  function apply(g: ListingGuess) {
    const patch: Partial<import("../lib/engine").Inputs> = {};
    if (g.price.value) patch.homeValue = g.price.value;
    if (g.state) { patch.state = g.state; }
    if (g.regionGuess) patch.region = g.regionGuess;
    if (g.homeContext) patch.homeType = g.homeContext;
    props.onApply(patch);
  }

  function previewMessage(g: ListingGuess) {
    const bits: string[] = [];
    if (g.price.value) bits.push(aud(g.price.value));
    if (g.state) bits.push(g.state);
    if (g.beds.value) bits.push(`${g.beds.value} bd`);
    return `Imported: ${bits.join(" · ") || "no fields detected"} — all editable below.`;
  }

  return (
    <div className="import">
      <div className="import-row">
        <input
          className="tinput url"
          type="url"
          placeholder="Paste a listing link (realestate.com.au, domain.com.au, homely…)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(url)}
          aria-label="Listing URL"
        />
        <button className="btn solid" onClick={() => run(url)} disabled={state === "loading"}>
          {state === "loading" ? "Reading…" : "Read listing"}
        </button>
      </div>
      {message ? <p className={"import-note " + (state === "error" ? "warn" : "ok")}>{message}</p> : null}
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
          <summary>Paste the listing text instead</summary>
          <textarea
            className="tinput"
            rows={6}
            placeholder="Copy the listing page text (price, address, beds/baths) and paste here…"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button
            className="btn"
            onClick={() => {
              const g = parseListingText(paste, url || "manual");
              setGuess(g);
              if (g.confidence === "none") {
                setMessage("Pasted, but nothing parsed — enter the fields manually below.");
                setState("error");
              } else {
                setState("done");
                setMessage(previewMessage(g));
                apply(g);
              }
            }}
          >
            Parse pasted text
          </button>
        </details>
      ) : null}
    </div>
  );
}
