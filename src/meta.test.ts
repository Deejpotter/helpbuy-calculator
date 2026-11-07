import { describe, expect, it } from "vitest";
import html from "../index.html?raw";
import manifestText from "../public/manifest.webmanifest?raw";

const publicFiles = Object.keys(import.meta.glob("../public/*", { query: "?url" })).map((p) =>
  p.replace("../public", ""),
);

describe("app icon and page metadata", () => {
  it("links the icons, manifest and share tags in index.html", () => {
    for (const needle of [
      '<link rel="icon" href="/favicon.ico"',
      '<link rel="icon" href="/favicon.svg" type="image/svg+xml"',
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png"',
      '<link rel="manifest" href="/manifest.webmanifest"',
      'name="application-name"',
      'name="theme-color" content="#faf8f4" media="(prefers-color-scheme: light)"',
      'media="(prefers-color-scheme: dark)"',
      'property="og:title"',
      'property="og:description"',
      'property="og:image" content="https://helpbuy.deejpotter.com/icon-512.png"',
    ]) {
      expect(html).toContain(needle);
    }
  });

  it("stays indexable: it is a public calculator", () => {
    expect(html).not.toContain("noindex");
  });

  it("only links icon files that exist in public/", () => {
    const linked = [...html.matchAll(/href="(\/[^"]+\.(?:ico|svg|png|webmanifest))"/g)].map((m) => m[1]);
    expect(linked.length).toBeGreaterThan(3);
    for (const path of linked) expect(publicFiles).toContain(path);
  });

  it("has a complete web manifest with existing icons", () => {
    const manifest = JSON.parse(manifestText);
    expect(manifest).toMatchObject({ start_url: "/", display: "standalone" });
    for (const key of ["name", "short_name", "description", "background_color", "theme_color"]) {
      expect(manifest[key]).toBeTruthy();
    }
    const icons = manifest.icons as { src: string; sizes: string; purpose: string }[];
    expect(icons.map((i) => i.sizes).sort()).toEqual(["192x192", "512x512", "512x512"]);
    expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of icons) expect(publicFiles).toContain(icon.src);
  });
});
