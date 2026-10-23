import { useState } from "react";
import { lookupArea, AREA_NOTE, type AreaMatch } from "../lib/areaLookup";
import { PRICE_CAPS } from "../lib/constants";
import { aud } from "../lib/format";

/**
 * Area checker in the property panel: type a postcode or suburb, get the official price cap
 * from the bundled snapshot (generated from the scheme's own postcode tool), and apply it.
 */
export default function AreaChecker(props: {
  onApply: (r: { state: AreaMatch["state"]; region: "major" | "rest" }) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AreaMatch[] | null>(null);
  const [used, setUsed] = useState<AreaMatch | null>(null);

  function run() {
    const r = lookupArea(q);
    setResults(r);
    setUsed(null);
  }

  function use(m: AreaMatch) {
    setUsed(m);
    props.onApply({ state: m.state, region: m.region });
  }

  return (
    <div className="areachk">
      <div className="import-row">
        <input
          className="tinput"
          placeholder="Postcode or suburb - e.g. 3200 or Frankston North"
          value={q}
          aria-label="Postcode or suburb"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
        />
        <button className="btn" onClick={run}>Check cap</button>
      </div>
      {used ? (
        <p className="import-note ok">
          Set: {used.state}, {used.region === "major" ? "capital / regional centre" : "rest of state"} - official cap {aud(used.cap)}
          {used.cap < Number((document.querySelector("#value") as HTMLInputElement | null)?.value ?? 0)
            ? " - your entered price is OVER this cap"
            : ""}
        </p>
      ) : null}
      {results && !used ? (
        results.length ? (
          <ul className="plain area-results">
            {results.map((m, i) => (
              <li key={i}>
                {m.suburb} {m.postcode} {m.state} - cap {aud(m.cap)}{" "}
                <button className="mini-cta" onClick={() => use(m)}>use this</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="import-note muted">
            Not in the bundled snapshot, so it is "rest of state" by default. Verify close calls on
            the official postcode tool.
          </p>
        )
      ) : null}
      <p className="hist">{AREA_NOTE}</p>
    </div>
  );
}
