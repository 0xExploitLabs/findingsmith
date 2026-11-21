import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function newProject(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "New project" }).first().click();
  // A name is all a new project asks for.
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveCount(1);
  await page.getByLabel("Project name").fill("External web application test");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "External web application test",
  );
}

/** The client is optional: it is added to the project when the report states one. */
async function setClient(page: Page, client: string) {
  await page.locator("#project-nav").getByRole("link", { name: "Report details" }).click();
  await page.getByRole("button", { name: "Add property" }).click();
  await page.getByRole("menuitem", { name: /Client/ }).click();
  await page.getByLabel("Client", { exact: true }).fill(client);
}

async function pdfText(path: string) {
  const doc = await getDocument({ data: new Uint8Array(await readFile(path)) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  const { info } = (await doc.getMetadata()) as { info: Record<string, string> };
  // Styled runs (syntax colours, bold) are separate items; join them as a reader sees them.
  return { text: pages.join(" ").replace(/\s+/g, " "), info, numPages: doc.numPages };
}

async function blankFinding(page: Page, title: string) {
  await page.getByRole("button", { name: "Add finding" }).click();
  await page.getByRole("menuitem", { name: /Blank finding/ }).click();
  await page.getByLabel("Title").fill(title);
}

/** The Markdown of every finding, as IndexedDB holds it. */
function storedBodies(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open("debrief");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction("findings").objectStore("findings").getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () =>
            resolve(all.result.map((finding: { body: string }) => finding.body).join("\n"));
        };
      }),
  );
}

/** Types a slash command and takes the one entry it narrows the menu down to. */
async function slash(page: Page, command: string) {
  const options = page.locator(".cm-tooltip-autocomplete").getByRole("option");
  await page.keyboard.type("/");
  await expect(options.first()).toBeVisible();
  await page.keyboard.type(command);
  await expect(options).toHaveCount(1);
  await page.keyboard.press("Enter");
}

test("the overview ends on the typeset page and a footer that leads on", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  // The footer keeps its height: it used to be squeezed to a sliver by its flex parent.
  expect((await footer.boundingBox())?.height).toBeGreaterThan(300);

  // The pinned section resolves into the sample finding, set as the PDF prints it.
  await page.getByRole("heading", { name: "Built to be read" }).scrollIntoViewIfNeeded();
  const sheet = page.locator("article.sheet");
  await expect(
    sheet.getByRole("heading", { name: "SQL injection in the login form" }),
  ).toBeVisible();
  await expect(sheet).toContainText("Critical");
  await expect(sheet).toContainText("Remediation");

  await footer.getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/#\/projects$/);
});

test("the projects page lists every project and opens its report", async ({ page }) => {
  await newProject(page);
  await page.getByRole("link", { name: "Projects" }).click();
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "External web application test", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Report for External web application test" }).click();
  await expect(page.getByRole("heading", { name: "Report" })).toBeVisible();
  await expect(page.locator('iframe[title="Report preview"]')).toBeVisible({ timeout: 30_000 });

  // The overview offers the same project again, and the way back to all of them.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pick up where you left off" })).toBeVisible();
  await page.getByRole("link", { name: "Your project", exact: true }).click();
  await expect(page).toHaveURL(/#\/projects$/);
});

test("on a phone the project menu is a drawer, and the library still adds a finding", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newProject(page);
  const nav = page.locator("#project-nav");
  await expect(nav).toBeHidden();
  await page.getByRole("button", { name: "Open project menu" }).click();
  await expect(nav).toBeVisible();

  // One pane at a time: the list, then the template with its way in.
  await nav.getByRole("button", { name: "Browse the library" }).click();
  await page.getByLabel("Search the library").fill("IDOR");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Add finding" })).toBeHidden();
  await dialog.getByRole("option").first().click();
  await dialog.getByRole("button", { name: "Add finding" }).click();

  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Insecure direct object reference",
  );
  await expect(nav).toBeHidden();
  // The document has the screen to itself: its title is not squeezed by a sidebar.
  const title = await page.getByLabel("Title", { exact: true }).boundingBox();
  expect(title?.width).toBeGreaterThan(300);
});

test("a new project opens on the library, and the report's own text has a place of its own", async ({
  page,
}) => {
  await newProject(page);
  const nav = page.locator("#project-nav");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "Start from a finding that is already written" }),
  ).toBeVisible();
  // The sidebar lists findings; the report's text is no longer an entry above them.
  await expect(nav).not.toContainText("Summary, scope and details");
  await expect(nav.getByRole("navigation", { name: "Report" }).getByRole("link")).toHaveText([
    "Report details",
    "Export PDF",
  ]);

  // A category opens the library on that category, a starting point on that finding.
  await main.getByRole("button", { name: /^Authentication/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("option")).toHaveCount(8);
  await page.keyboard.press("Escape");
  await main.getByRole("button", { name: /^SQL injection/ }).click();
  await expect(dialog.getByRole("heading", { name: "SQL injection" })).toBeVisible();
  await dialog.getByRole("button", { name: "Add finding" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("SQL injection");

  // The overview now lists the finding, and leads on to the report's two sides.
  await nav.getByRole("link", { name: "External web application test" }).click();
  await expect(main.getByRole("link", { name: /SQL injection/ })).toContainText("Critical");
  await expect(main).toContainText("Executive summary to write");
  await main.getByRole("link", { name: "Report details" }).click();
  await expect(page).toHaveURL(/\/details$/);
  await expect(page.getByRole("heading", { name: "Report", exact: true })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "External web application test",
  );
  const editor = page.locator("article .cm-content");
  await expect(editor).toContainText("Executive summary");
  await editor.locator(".cm-line", { hasText: "What was tested, how it held up" }).click();
  await page.keyboard.type("The application held up well.");
  await expect(editor).not.toContainText("What was tested, how it held up");

  await page.getByRole("link", { name: "PDF", exact: true }).click();
  await expect(page).toHaveURL(/\/report$/);
  await expect(page.getByText("Executive summary is written")).toBeVisible();
});

test("a blank finding says what each section is for, and what it still needs", async ({ page }) => {
  await newProject(page);
  await page.getByRole("button", { name: "Add finding" }).click();
  await page.getByRole("menuitem", { name: /Blank finding/ }).click();
  const article = page.locator("article");
  await expect(article).toContainText("Needs a title, a write-up and a CVSS score");
  const editor = article.locator(".cm-content");
  await expect(editor).toContainText("What is wrong and where, in a paragraph or two.");
  await expect(editor).toContainText("How to fix it, the most effective measure first.");

  // A prompt is not text: it goes as soon as its section is written, and is never saved.
  await page.getByLabel("Title").fill("Open redirect");
  await editor.locator(".cm-line", { hasText: "What is wrong and where" }).click();
  await page.keyboard.type("The next parameter is not validated.");
  await expect(editor).not.toContainText("What is wrong and where");
  await expect(article).toContainText("Needs remediation and a CVSS score");
  await editor.locator(".cm-line", { hasText: "How to fix it" }).click();
  await page.keyboard.type("Allow only relative paths.");
  await page.getByLabel("CVSS vector or score").fill("6.1");
  await expect(article).toContainText("Ready for the report");
});

test("severity follows the CVSS score: 5.3 is Medium", async ({ page }) => {
  await newProject(page);
  await blankFinding(page, "Verbose error messages");
  const severity = page.locator("dd").first();
  await expect(severity).toContainText("set by you");

  const cvss = page.getByLabel("CVSS vector or score");
  await cvss.fill("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N");
  await expect(page.getByTitle("CVSS 3.1")).toHaveText("5.3");
  await expect(severity).toContainText("Medium");
  await expect(severity).toContainText("from the CVSS score");

  // A bare score from another tool is rated the same way.
  await cvss.fill("9.1");
  await expect(severity).toContainText("Critical");
  await cvss.fill("not a vector");
  await expect(page.getByText("Not a valid vector or score")).toBeVisible();
});

test("rating a scored finding differently needs a reason", async ({ page }) => {
  await newProject(page);
  await page.getByRole("main").getByRole("button", { name: "Browse the library" }).click();
  await page.getByLabel("Search the library").fill("IDOR");
  await page.getByRole("dialog").getByRole("button", { name: "Add finding" }).click();
  const severity = page.locator("dd").first();
  await expect(severity).toContainText("Medium");

  // The menu is the five ratings, each a dot and a name, with the current one marked.
  await page.getByRole("button", { name: "Severity: Medium" }).click();
  await expect(page.getByRole("menuitemradio")).toHaveText([
    "Critical",
    "High",
    "Medium",
    "Low",
    "Info",
  ]);
  await expect(page.getByRole("menuitemradio", { name: "Medium" })).toBeChecked();
  await page.getByRole("menuitemradio", { name: "High" }).click();
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: "Rate High" });
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Reason").fill("Invoices include full card holder addresses.");
  await save.click();

  await expect(severity).toContainText("High");
  await expect(severity).toContainText("adjusted from Medium");
  await expect(page.getByText("Why High:")).toBeVisible();

  await page.getByRole("button", { name: "Use CVSS" }).click();
  await expect(severity).toContainText("from the CVSS score");
});

test("typing a code fence closes it, so the text after stays prose", async ({ page }) => {
  await newProject(page);
  await blankFinding(page, "Fences");
  const editor = page.locator("article .cm-content");
  await editor.locator(".cm-line").nth(2).click();
  await page.keyboard.type("```");
  // The closing fence appears at once: the headings below are still headings.
  await expect(editor.locator(".cm-lp-h2", { hasText: "Impact" })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.type("echo hi");
  await page.keyboard.press("Enter");
  await page.keyboard.type("```");
  await page.keyboard.press("Enter");
  await page.keyboard.type("After the block.");

  await expect(editor.locator(".cm-lp-codeline")).toHaveCount(3);
  await expect(
    editor.locator(".cm-line:not(.cm-lp-codeline)", { hasText: "After the block." }),
  ).toBeVisible();
});

test("a finding always has its main properties, and the rest come from the picker", async ({
  page,
}) => {
  await newProject(page);
  await blankFinding(page, "Open redirect");
  // Endpoint, host and CWE are there to fill from the start.
  await page.getByLabel("Endpoint URL").fill("https://app.example.com/login?next=");
  await page.getByRole("button", { name: "HTTP method" }).click();
  await page.getByRole("menuitemradio", { name: "GET" }).click();
  await expect(page.getByRole("button", { name: "HTTP method" })).toHaveText("GET");
  // Empty fields show a real value as their example, not an instruction.
  await expect(page.getByLabel("Host", { exact: true })).toHaveAttribute(
    "placeholder",
    "app.example.com",
  );
  await expect(page.getByLabel("CWE", { exact: true })).toHaveAttribute("placeholder", "CWE-79");
  await expect(page.getByLabel("CVSS vector or score")).toHaveAttribute(
    "placeholder",
    "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  );
  await expect(page.getByRole("button", { name: "Remove Endpoint" })).toHaveCount(0);

  await expect(page.getByLabel("Parameter", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add property" }).click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Parameterinvoice_id",
    "Port443",
    "Affectedapi.example.com",
    "CVECVE-2021-44228",
  ]);
  await page.getByRole("menuitem", { name: /Parameter/ }).click();
  await expect(page.getByLabel("Parameter", { exact: true })).toBeFocused();
  await page.keyboard.type("next");
  await page.getByRole("button", { name: "Remove Parameter" }).click();
  await expect(page.getByLabel("Parameter", { exact: true })).toHaveCount(0);
});

test("the CVSS calculator builds the vector, and the severity follows", async ({ page }) => {
  await newProject(page);
  await blankFinding(page, "Unauthenticated admin API");
  await page.getByRole("button", { name: "Calculate" }).click();
  const dialog = page.getByRole("dialog");
  for (const metric of ["Confidentiality", "Integrity", "Availability"]) {
    await dialog
      .getByRole("group", { name: new RegExp(metric) })
      .getByText("High")
      .click();
  }
  await expect(dialog).toContainText("9.8");
  await dialog.getByRole("button", { name: "Use this score" }).click();
  await expect(page.getByLabel("CVSS vector or score")).toHaveValue(
    "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  );
  await expect(page.locator("dd").first()).toContainText("Critical");
});

test("typing / opens a menu of blocks, filtered as you type", async ({ page }) => {
  await newProject(page);
  await blankFinding(page, "Slash menu");
  const editor = page.locator("article .cm-content");
  await editor.locator(".cm-line").nth(2).click();
  await page.keyboard.type("/");
  const menu = page.locator(".cm-tooltip-autocomplete");
  // The formatting entries lead without a heading; the later groups keep theirs.
  await expect(menu.getByRole("option", { name: /Heading 1/ })).toBeVisible();
  await expect(menu).not.toContainText("Basic formatting");
  await expect(menu).toContainText("Code blocks");
  await page.keyboard.type("tab");
  await expect(menu.getByRole("option")).toHaveCount(1);
  await expect(menu.getByRole("option", { name: /Table/ })).toBeVisible();
});

test("/table is a table at once, filled in cell by cell with no Markdown in sight", async ({
  page,
}) => {
  await newProject(page);
  await blankFinding(page, "Tables");
  const editor = page.locator("article .cm-content");
  await editor.locator(".cm-line").nth(2).click();
  await slash(page, "table");

  // The grid is there without moving the cursor away, and the caret is in its first cell.
  const table = editor.locator(".cm-lp-table table");
  await expect(table).toBeVisible();
  await expect(page.getByLabel("Column 1 heading")).toBeFocused();
  await expect(editor).not.toContainText("|");

  await page.keyboard.type("Target");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Notes");
  await page.keyboard.press("Tab");
  await page.keyboard.type("app.example.com");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Production");
  // Tab in the last cell starts a new row.
  await page.keyboard.press("Tab");
  await page.keyboard.type("api.example.com");
  await expect(page.getByLabel("Row 2, column 1")).toBeFocused();
  await expect(table.locator("tr")).toHaveCount(3);
  await expect(editor).not.toContainText("|");

  // Undo works from inside a cell, and Escape goes back to the text below.
  await page.keyboard.press("Control+z");
  await expect(page.getByLabel("Row 2, column 1")).toHaveText("api.example.co");
  await page.keyboard.press("Control+Shift+z");
  await page.keyboard.press("Escape");
  await page.keyboard.type("Out of scope: third-party services.");
  await expect(table.locator("tr")).toHaveCount(3);
  await expect(
    editor.locator(".cm-line", { hasText: "Out of scope: third-party services." }),
  ).toBeVisible();

  await page.getByLabel("Row 2, column 2").click();
  await page.getByRole("button", { name: "Add column" }).click();
  await page.keyboard.type("Owner");
  await expect(table.locator("th")).toHaveText(["Target", "Notes", "Owner"]);
  await page.getByLabel("Row 2, column 1").click();
  await page.getByRole("button", { name: "Delete row" }).click();
  await expect(table.locator("tr")).toHaveCount(2);

  // What is saved is an ordinary Markdown table, and it comes back the same after a reload.
  await expect
    .poll(() => storedBodies(page))
    .toContain(
      "| Target | Notes | Owner |\n| --- | --- | --- |\n| app.example.com | Production |  |\n\n",
    );
  await page.reload();
  const saved = page.locator("article .cm-lp-table table");
  await expect(saved.locator("th")).toHaveText(["Target", "Notes", "Owner"]);
  await expect(saved.locator("td")).toHaveText(["app.example.com", "Production", ""]);
});

test("a code block names its language and lets you change it", async ({ page }) => {
  await newProject(page);
  await blankFinding(page, "Code blocks");
  const editor = page.locator("article .cm-content");
  await editor.locator(".cm-line").nth(2).click();
  await slash(page, "python");
  await page.keyboard.type("print(1)");
  await expect(page.getByRole("button", { name: "Code language: Python" })).toBeVisible();

  await page.getByRole("button", { name: "Code language: Python" }).click();
  await expect(page.getByRole("option", { name: "Python" })).toBeVisible();
  await page.getByLabel("Search languages").fill("bas");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Code language: Bash" })).toBeVisible();

  // Away from the block the fences are hidden and the name stays on it.
  await page.getByLabel("Title", { exact: true }).click();
  await expect(editor).not.toContainText("```");
  await expect(editor.locator(".cm-lp-open")).toContainText("Bash");

  // A block typed by hand without a language is plain text until one is picked.
  await editor.locator(".cm-line", { hasText: /^1\./ }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Run it:");
  await page.keyboard.press("Enter");
  await page.keyboard.type("```");
  await page.getByRole("button", { name: "Code language: Plain text" }).click();
  await page.getByRole("option", { name: "JSON" }).click();
  await expect(page.getByRole("button", { name: "Code language: JSON" })).toBeVisible();
});

test("Ctrl+K opens search, in the editor too, where the link shortcut moved aside", async ({
  page,
}) => {
  await newProject(page);
  await blankFinding(page, "Shortcuts");
  await expect(page.getByRole("button", { name: /^Search/ })).toContainText("K");
  const editor = page.locator("article .cm-content");
  await editor.locator(".cm-line").nth(2).click();
  await page.keyboard.type("See the advisory");

  await page.keyboard.press("Control+k");
  const search = page.getByLabel("Search findings and commands");
  await expect(search).toBeFocused();
  await search.fill("short");
  await expect(page.getByRole("dialog").getByRole("button", { name: /Shortcuts/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toHaveCount(0);
  // Ctrl+K left the text alone; Ctrl+Shift+K is the link now.
  await expect(editor).not.toContainText("](");
  await page.keyboard.press("Control+Shift+k");
  await expect(editor).toContainText("[link text](https://)");
});

test("the sidebar folds to a rail of icons and stays that way", async ({ page }) => {
  await newProject(page);
  await page.getByRole("button", { name: "Add finding" }).click();
  await page.getByRole("menuitem", { name: /From library/ }).click();
  await page.getByLabel("Search the library").fill("IDOR");
  await page.getByRole("dialog").getByRole("button", { name: "Add finding" }).click();
  const nav = page.locator("#project-nav");
  expect((await nav.boundingBox())?.width).toBeGreaterThan(250);

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  const expand = page.getByRole("button", { name: "Expand sidebar" });
  await expect(expand).toBeVisible();
  await expect.poll(async () => (await nav.boundingBox())?.width).toBeLessThan(80);
  // Everything is still one click away: the finding, the report, a new finding.
  await expect(
    nav.getByRole("link", { name: "F-01 Insecure direct object reference" }),
  ).toBeVisible();
  await expect(nav.getByRole("button", { name: "Add finding" })).toBeVisible();
  await nav.getByRole("link", { name: "Report details" }).click();
  await expect(page).toHaveURL(/\/details$/);

  // The choice outlives a reload, and Ctrl+\ opens it again.
  await page.reload();
  await expect(expand).toBeVisible();
  await page.keyboard.press("Control+\\");
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "External web application test" })).toBeVisible();
});

test("a project card stacks a page per finding behind its cover, and they follow the pointer", async ({
  page,
}) => {
  await newProject(page);
  for (const name of ["IDOR", "SQL injection"]) {
    await page.getByRole("button", { name: "Add finding" }).click();
    await page.getByRole("menuitem", { name: /From library/ }).click();
    await page.getByLabel("Search the library").fill(name);
    await page.getByRole("dialog").getByRole("button", { name: "Add finding" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.locator("#project-nav").getByRole("link", { name: "Projects" }).click();

  const card = page.getByRole("listitem").filter({ hasText: "External web application test" });
  await expect(card).toContainText("2 findings");
  await expect(card.locator(".stack-page")).toHaveCount(2);
  await expect(card.locator(".pixel-corner")).toHaveAttribute("data-corner", "br");
  // The severity mix is a row of pixels, shared between the two severities found.
  await expect(card.getByRole("img", { name: "1 Critical, 1 Medium" })).toBeVisible();
  await expect(card.locator(".pixel-meter-cell")).toHaveCount(24);

  // Hovering fans the pages out, and the far one travels with the pointer.
  const far = card.locator(".stack-page").first();
  const left = async () => (await far.boundingBox())?.x ?? 0;
  const rest = await left();
  await card.hover({ position: { x: 340, y: 40 } });
  await expect.poll(left).toBeGreaterThan(rest + 4);
  const fanned = await left();
  await card.hover({ position: { x: 20, y: 40 } });
  await expect.poll(left).toBeLessThan(fanned - 4);
});

test("a project can be renamed and duplicated from the projects page", async ({ page }) => {
  await newProject(page);
  await page.goto("/#/projects");
  await page.getByRole("button", { name: "Actions for External web application test" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByLabel("Project name").fill("Retest, Q3");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByRole("link", { name: "Retest, Q3", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Actions for Retest, Q3" }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(page.getByRole("link", { name: "Retest, Q3 (copy)", exact: true })).toBeVisible();
});

test("the PDF is a clean report: no Markdown, no watermark", async ({ page }) => {
  await newProject(page);
  await setClient(page, "Northwind Traders");
  await page.locator("#project-nav").getByRole("button", { name: "Browse the library" }).click();
  await page.getByLabel("Search the library").fill("IDOR");
  await page.getByRole("dialog").getByRole("button", { name: "Add finding" }).click();

  // Write Markdown in the live editor, as a tester would.
  const editor = page.locator("article .cm-content");
  await editor.locator(".cm-line", { hasText: /^1\./ }).click();
  await page.keyboard.press("End");
  await page.keyboard.type("Sign in as **alice** and open `/api/invoices/1001`.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Change the id to `1002`.");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("```http");
  await page.keyboard.press("Enter");
  await page.keyboard.type("GET /api/invoices/1002 HTTP/1.1");
  await page.keyboard.press("Enter");
  await page.keyboard.type("```");

  await page.getByLabel("Endpoint URL").fill("https://app.example.com/api/invoices/{id}");

  // The summary is the report's own text: it is written under Report details.
  await page.locator("#project-nav").getByRole("link", { name: "Report details" }).click();
  await page.locator(".cm-line", { hasText: "What was tested, how it held up" }).click();
  await page.keyboard.type("Three findings need attention before the next release.");

  await page.getByRole("link", { name: "PDF", exact: true }).click();
  await page.getByLabel("Prepared by").fill("Kestrel Security");
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.locator('iframe[title="Report preview"]')).toBeVisible({ timeout: 30_000 });

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Northwind-Traders-External-web-application-test.pdf");
  const { text, info } = await pdfText(await file.path());

  expect(text).toContain("Insecure direct object reference");
  expect(text).toContain("Sign in as");
  expect(text).toContain("/api/invoices/1001");
  expect(text).toContain("GET /api/invoices/1002");
  expect(text).toContain("https://app.example.com/api/invoices/{id}");
  expect(text).toContain("Kestrel Security");
  expect(text).toContain("Three findings need attention before the next release.");
  for (const markup of ["**", "```", "## ", "asset:", "](http"]) {
    expect(text, `raw Markdown "${markup}" in the PDF`).not.toContain(markup);
  }
  // The document properties carry the author's name, not the tool's.
  expect(info.Producer).toBe("Kestrel Security");
  expect(info.Creator).toBe("Kestrel Security");
  expect(JSON.stringify(info)).not.toMatch(/react-pdf|debrief/i);
});
