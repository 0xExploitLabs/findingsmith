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

function setHref(id: string, href: string): void {
  const link = document.getElementById(id);
  if (link instanceof HTMLLinkElement) link.href = href;
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
