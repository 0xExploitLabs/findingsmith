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

/** Languages a pentest report's unlabelled code is most likely to be in. */
const GUESSABLE = [
  "http",
  "json",
  "bash",
  "shell",
  "xml",
  "javascript",
  "python",
  "sql",
  "powershell",
  "yaml",
];

/**
 * Highlights a code block. A block without a language is highlighted only when
 * one of the common report languages clearly fits, so plain output stays plain.
 */
export function highlightCode(code: string, lang: string | null | undefined) {
  if (canHighlight(lang)) return lowlight.highlight(lang, code);
  // An HTTP message is recognisable from its first line; auto-detection is weak at it.
  if (/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \S+ HTTP\/\d|^HTTP\/\d(\.\d)? \d{3}/.test(code)) {
    return lowlight.highlight("http", code);
  }
  const guess = lowlight.highlightAuto(code, { subset: GUESSABLE });
  return (guess.data?.relevance ?? 0) >= 8 ? guess : null;
}
