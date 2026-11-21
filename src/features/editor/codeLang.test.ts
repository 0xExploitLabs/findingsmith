import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { describe, expect, it } from "vitest";
import { canHighlight } from "../../markdown/highlight";
import { CODE_LANGUAGES, languageLabel } from "./codeLang";

describe("code block languages", () => {
  it("names a block by what its fence says", () => {
    expect(languageLabel("bash")).toBe("Bash");
    expect(languageLabel("sh")).toBe("Bash");
    expect(languageLabel("JS")).toBe("JavaScript");
    expect(languageLabel("")).toBe("Plain text");
    expect(languageLabel("terraform")).toBe("terraform");
  });

  it("offers only languages that both the editor and the PDF highlight", () => {
    for (const { id } of CODE_LANGUAGES) {
      expect(canHighlight(id), `${id} in the PDF`).toBe(true);
      expect(
        LanguageDescription.matchLanguageName(languages, id, true),
        `${id} in the editor`,
      ).not.toBeNull();
    }
  });
});
