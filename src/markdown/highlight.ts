import apache from "highlight.js/lib/languages/apache";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import http from "highlight.js/lib/languages/http";
import nginx from "highlight.js/lib/languages/nginx";
import powershell from "highlight.js/lib/languages/powershell";
import { common, createLowlight } from "lowlight";

/** One highlighter for the preview and the PDF, so both colour code alike. */
export const lowlight = createLowlight(common);
lowlight.register({ http, powershell, dockerfile, nginx, apache });
lowlight.registerAlias({
  http: ["request", "response", "raw"],
  shell: ["sh", "console", "zsh"],
  powershell: ["ps1", "ps"],
});

export function canHighlight(lang: string | null | undefined): lang is string {
  return !!lang && lowlight.registered(lang);
}
