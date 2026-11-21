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
  await page.getByRole("button", { name: "Browse the library" }).click();
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
  await page.getByRole("button", { name: "Browse the library" }).click();
  await page.getByLabel("Search the library").fill("IDOR");
  await page.getByRole("dialog").getByRole("button", { name: "Add finding" }).click();
  const severity = page.locator("dd").first();
  await expect(severity).toContainText("Medium");

  await page.getByRole("button", { name: "Severity: Medium" }).click();
  await page.getByRole("menuitem", { name: /High/ }).click();
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
  await page.getByRole("menuitem", { name: "GET" }).click();
  await expect(page.getByRole("button", { name: "HTTP method" })).toHaveText("GET");
  await expect(page.getByLabel("Host", { exact: true })).toBeVisible();
  await expect(page.getByLabel("CWE", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Endpoint" })).toHaveCount(0);

  await expect(page.getByLabel("Parameter", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add property" }).click();
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

  // What was saved is an ordinary Markdown table: it comes back the same after a reload.
  await expect(page.locator("#project-nav [role=status] .animate-spin")).toHaveCount(0);
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
  await editor.locator(".cm-line", { hasText: /^1\.\s*$/ }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Run it:");
  await page.keyboard.press("Enter");
  await page.keyboard.type("```");
  await page.getByRole("button", { name: "Code language: Plain text" }).click();
  await page.getByRole("option", { name: "JSON" }).click();
  await expect(page.getByRole("button", { name: "Code language: JSON" })).toBeVisible();
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
  await page.getByRole("button", { name: "Browse the library" }).click();
  await page.getByLabel("Search the library").fill("IDOR");
  await page.getByRole("dialog").getByRole("button", { name: "Add finding" }).click();

  // Write Markdown in the live editor, as a tester would.
  const editor = page.locator("article .cm-content");
  await editor.locator(".cm-line", { hasText: /^1\.\s*$/ }).click();
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

  await page.getByRole("link", { name: "Export PDF" }).click();
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
  for (const markup of ["**", "```", "## ", "asset:", "](http"]) {
    expect(text, `raw Markdown "${markup}" in the PDF`).not.toContain(markup);
  }
  // The document properties carry the author's name, not the tool's.
  expect(info.Producer).toBe("Kestrel Security");
  expect(info.Creator).toBe("Kestrel Security");
  expect(JSON.stringify(info)).not.toMatch(/react-pdf|debrief/i);
});
