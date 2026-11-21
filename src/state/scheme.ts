import { useSyncExternalStore } from "react";

export type Scheme = "dark" | "light";
const KEY = "debrief-scheme";
const listeners = new Set<() => void>();

/**
 * What the browser shows around the page in each theme: the tab icon, and the
 * bar colour on phones. index.html sets the same before the app loads.
 */
const BROWSER: Record<Scheme, { icon: string; bar: string }> = {
  light: { icon: "/favicon.svg", bar: "#f8f8fa" },
  dark: { icon: "/favicon-dark.svg", bar: "#0c0c10" },
};

export function getScheme(): Scheme {
  return document.documentElement.dataset.scheme === "light" ? "light" : "dark";
}

export function setScheme(scheme: Scheme): void {
  document.documentElement.dataset.scheme = scheme;
  const icon = document.getElementById("icon");
  if (icon instanceof HTMLLinkElement) icon.href = BROWSER[scheme].icon;
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
