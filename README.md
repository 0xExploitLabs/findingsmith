# Debrief, by 0xExploitLabs

Debrief is a penetration test report writer that runs entirely in your browser.
You write each finding as one Markdown document, paste in its CVSS vector and screenshots, and download a typeset PDF.
There is no account and no server: projects are stored in your browser's IndexedDB and never leave your device.

## What it does

- **Writing like a notes app.**
  Each finding and the report's own text are single Markdown documents with live preview, in the manner of Obsidian.
  Markup is hidden and rendered in place, and shows again on the line you are editing.
  Type `/` on an empty line for headings, HTTP requests, request and response pairs, code blocks, tables, checklists and images.
  Code fences close themselves as you type them, and code is highlighted by language.
- **Properties when you need them.**
  Every finding has a severity, a status and a CVSS field.
  Endpoint and method, parameter, host, port, affected assets, CWE and CVE are added from the "Add property" picker, so a finding only shows what applies to it.
  Usual sections such as Impact or Remediation are one click away under the write-up.
- **All your projects in one place.**
  The Projects page lists every engagement with its severity mix and a direct link to its report.
- **Find anything.**
  Press Ctrl+P (Cmd+P on macOS) to jump to a finding or run a command.
- **Severity you can defend.**
  Paste a CVSS 3.1 or 4.0 vector, or a bare base score from another tool, and the severity is derived from it using the rating scale in the CVSS specification, so a 5.3 is always Medium.
  To rate a finding differently, pick another severity and give a reason; the report prints both ratings and the reason.
- **A report, not a printout.**
  The PDF is laid out with a cover, contents with page numbers and links, an executive summary with a risk overview, a findings table, one section per finding and a severity appendix.
  Markdown is rendered, never printed raw.
  No browser headers or footers and no tool name appear in the file; the document properties carry the name you enter under "Prepared by".
- **A library of 50 findings.**
  Common web, API, cloud and infrastructure issues come pre-written with a CVSS 3.1 vector, a CWE and references, ready to adapt.
- **Your data stays yours.**
  Export a project to a single file to back it up or move it to another browser, and import it again later.
  Private notes on a finding are never included in the report.

## How the report is built from your documents

The project document holds the text that comes before the findings.
Each `## Heading` in it becomes a numbered section.
A section whose title contains "summary" opens the report together with the risk overview, and a section titled "Conclusion" closes it after the findings.

A finding document works the same way.
Its `##` sections, typically Description, Impact, Steps to reproduce, Remediation and References, appear in the report in the order you write them.
Sections left empty are skipped, and so are list items left blank.

## Severity rules

| CVSS base score | Severity |
| --------------- | -------- |
| 9.0 to 10.0     | Critical |
| 7.0 to 8.9      | High     |
| 4.0 to 6.9      | Medium   |
| 0.1 to 3.9      | Low      |
| 0.0             | Info     |

CVSS 3.1 scores follow the base score formula of the specification.
CVSS 4.0 scores use the macrovector lookup published by FIRST and are labelled CVSS-B 4.0, or CVSS-BT 4.0 when Exploit Maturity is set.
Vectors are parsed strictly: a malformed vector is rejected instead of scored.

## Run it locally

You need Node.js 22 or later and pnpm.

```sh
pnpm install
pnpm dev
```

Then open the address Vite prints.
`pnpm build` writes a static site to `dist/` that any static host can serve; there is no backend.

## Checks

```sh
pnpm check       # Biome lint and format
pnpm typecheck   # TypeScript
pnpm test        # unit tests: CVSS scoring, severity rules, Markdown sections
pnpm e2e         # browser tests against the production build
```

The end-to-end tests create a project, score and override findings, download the PDF and read its text to confirm that no raw Markdown or tool name ends up in it.
They use Playwright's Chromium; to use one already installed, set `CHROMIUM_PATH`, for example `CHROMIUM_PATH=/usr/bin/chromium pnpm e2e`.

## Project layout

```
src/domain      types, CVSS scoring, severity rules
src/data        IndexedDB storage, images, import and export, the finding library
src/markdown    Markdown parsing, highlighting and section splitting
src/features    the screens: projects, the editor, the finding library, the report
src/pdf         the PDF report, laid out with react-pdf
patches         two small fixes to react-pdf, applied by pnpm
```

## Security

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## License

The code is licensed under either of [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.

Fonts bundled in `public/fonts` keep their own licenses:

- JetBrains Mono, SIL Open Font License 1.1, see `LICENSES/OFL-1.1-JetBrainsMono.txt`.
- Noto Sans, a Latin, Greek and Cyrillic subset used as the PDF fallback, SIL Open Font License 1.1, see `LICENSES/OFL-1.1-NotoSans.txt`.
- Geist and Instrument Serif, the interface typefaces, SIL Open Font License 1.1, installed from the `@fontsource` packages.
- 0x Sans, used in the PDF only, is the 0xExploitLabs brand typeface and is not covered by the code license.
