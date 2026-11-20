import { useSyncExternalStore } from "react";

export type Scheme = "dark" | "light";
const KEY = "debrief-scheme";
const listeners = new Set<() => void>();

export function getScheme(): Scheme {
  return document.documentElement.dataset.scheme === "light" ? "light" : "dark";
}

export function setScheme(scheme: Scheme): void {
  document.documentElement.dataset.scheme = scheme;
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
