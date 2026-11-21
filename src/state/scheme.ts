import { useSyncExternalStore } from "react";

export type Scheme = "dark" | "light";
const KEY = "debrief-scheme";
const listeners = new Set<() => void>();

/**
 * What the browser shows around the page in each theme: the tab icon, as SVG
 * and as the PNG that Chromium browsers often pick for the tab, and the bar
 * colour on phones. index.html sets the same before the app loads.
 */
const BROWSER: Record<Scheme, { icon: string; png: string; bar: string }> = {
  light: { icon: "/favicon.svg", png: "/favicon-32.png", bar: "#f8f8fa" },
  dark: { icon: "/favicon-dark.svg", png: "/favicon-dark-32.png", bar: "#0c0c10" },
};

/**
 * The icons as data URLs, once read. Pointing the tab at a file makes the
 * browser request it again on every switch, which a live site answers in
 * about a second; a data URL is drawn at once.
 */
const inlined = new Map<string, string>();

/** Reads every icon into memory, so later theme switches need no request. */
export function prepareIcons(): void {
  for (const path of Object.values(BROWSER).flatMap((b) => [b.icon, b.png])) {
    fetch(path)
      .then((response) => (response.ok ? response.blob() : Promise.reject()))
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }),
      )
      .then((url) => inlined.set(path, url))
      // Offline or blocked: switching still works, by address.
      .catch(() => {});
  }
}

function setHref(id: string, path: string): void {
  const link = document.getElementById(id);
  if (link instanceof HTMLLinkElement) link.href = inlined.get(path) ?? path;
}

export function getScheme(): Scheme {
  return document.documentElement.dataset.scheme === "light" ? "light" : "dark";
}

export function setScheme(scheme: Scheme): void {
  document.documentElement.dataset.scheme = scheme;
  setHref("icon", BROWSER[scheme].icon);
  setHref("icon-png", BROWSER[scheme].png);
  document.getElementById("bar")?.setAttribute("content", BROWSER[scheme].bar);
  try {
    localStorage.setItem(KEY, scheme);
  } catch {
    // Storage blocked: the choice still holds for this session.
  }
  for (const l of listeners) l();
}

export function useScheme(): Scheme {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, getScheme);
}
