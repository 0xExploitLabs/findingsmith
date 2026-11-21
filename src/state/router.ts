import { useSyncExternalStore } from "react";

export type Route =
  | { name: "home" }
  | { name: "projects" }
  | { name: "project"; projectId: string; view: "overview" | "report" }
  | { name: "finding"; projectId: string; findingId: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "p" && parts[1]) {
    if (parts[2] === "f" && parts[3])
      return { name: "finding", projectId: parts[1], findingId: parts[3] };
    return {
      name: "project",
      projectId: parts[1],
      view: parts[2] === "report" ? "report" : "overview",
    };
  }
  if (parts[0] === "projects") return { name: "projects" };
  return { name: "home" };
}

export function href(route: Route): string {
  switch (route.name) {
    case "home":
      return "#/";
    case "projects":
      return "#/projects";
    case "project":
      return `#/p/${route.projectId}${route.view === "report" ? "/report" : ""}`;
    case "finding":
      return `#/p/${route.projectId}/f/${route.findingId}`;
  }
}

export function navigate(route: Route, replace = false): void {
  const target = href(route);
  if (replace) history.replaceState(null, "", target);
  else history.pushState(null, "", target);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  return parseHash(hash);
}
