import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { parseMoney, parsePct } from "../lib/format";

/** Counts a number up from its previous value; respects prefers-reduced-motion. */
export function useAnimatedNumber(target: number, duration = 380): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduce || !Number.isFinite(target)) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * eased;
      setDisplay(v);
      fromRef.current = v;
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, reduce]);

  return display;
}

/** Adds .in-view once when the element first scrolls into position (needs a ref). */
export function useInView(): [(el: HTMLElement | null) => void, boolean] {
  const [seen, setSeen] = useState(false);
  const ref = useRef<Element | null>(null);
  useEffect(() => {
    if (seen || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setSeen(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.08 },
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  const set = (el: HTMLElement | null) => {
    if (el) ref.current = el;
  };
  return [set, seen];
}

export function Section(props: {
  title: string;
  id?: string;
  index?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const [ref, seen] = useInView();
  return (
    <section className={"sec" + (seen ? " in-view" : "")} id={props.id} ref={ref}>
      <div className="sec-aside">
        <h2>{props.index ? <span className="lead">{props.index}</span> : null}{props.title}</h2>
        {props.aside}
      </div>
      {props.children}
    </section>
  );
}

export function Row(props: {
  label: string;
  note?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="row">
      <label className="row-label" htmlFor={props.htmlFor}>
        {props.label}
        {props.note ? <span className="row-note">{props.note}</span> : null}
      </label>
      <div className="row-input">{props.children}</div>
    </div>
  );
}

export function MoneyInput(props: {
  id?: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  wide?: boolean;
}) {
  return (
    <span className={"money-wrap" + (props.wide ? " wide" : "")}>
      <span className="money-glyph">$</span>
      <input
        id={props.id}
        className="tinput num"
        type="number"
        inputMode="numeric"
        min={props.min ?? 0}
        max={props.max}
        step={props.step ?? 1000}
        value={Number.isFinite(props.value) ? String(Math.round(props.value)) : "0"}
        onChange={(e) => props.onChange(parseMoney(e.target.value))}
      />
    </span>
  );
}

export function NumberInput(props: {
  id?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      id={props.id}
      className="tinput num"
      type="number"
      min={props.min ?? 0}
      max={props.max}
      step={props.step ?? 1}
      value={Number.isFinite(props.value) ? String(props.value) : "0"}
      onChange={(e) => props.onChange(parseMoney(e.target.value))}
    />
  );
}

export function PctInput(props: {
  id?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <span className="pct-wrap">
      <input
        id={props.id}
        className="tinput num"
        type="number"
        min={props.min ?? 0}
        max={props.max}
        step={props.step ?? 0.1}
        value={Number.isFinite(props.value) ? String(props.value) : "0"}
        onChange={(e) => props.onChange(parsePct(e.target.value))}
      />
      <span className="money-glyph">%</span>
    </span>
  );
}

export function Seg<T extends string>(props: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <fieldset className="seg" role="radiogroup" aria-label={props.label}>
      <legend className="sr-only">{props.label}</legend>
      {props.options.map((o) => (
        <label key={o.value} title={o.title} className={o.value === props.value ? "seg-on" : ""}>
          <input
            type="radio"
            name={props.name}
            value={o.value}
            checked={o.value === props.value}
            onChange={() => props.onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

export function SelectRaw<T extends string>(props: {
  id?: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  ariaLabel?: string;
}) {
  return (
    <select
      id={props.id}
      className="tinput select"
      aria-label={props.ariaLabel}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value as T)}
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function SliderRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <Row label={props.label}>
      <span className="range-wrap">
        <input
          type="range"
          aria-label={props.label}
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          value={props.value}
          onChange={(e) => props.onChange(Number(e.target.value))}
        />
        <span className="range-val">{props.display}</span>
      </span>
    </Row>
  );
}
