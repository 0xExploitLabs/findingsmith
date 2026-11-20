import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function newProject(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel("Project name").fill("External web application test");
  await page.getByLabel("Client").fill("Northwind Traders");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("External web application test");
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

test("optional properties come from the picker", async ({ page }) => {
  await newProject(page);
  await blankFinding(page, "Open redirect");
  await expect(page.getByLabel("Endpoint URL")).toHaveCount(0);
  await page.getByRole("button", { name: "Add property" }).click();
  await page.getByRole("menuitem", { name: /Endpoint/ }).click();
  await expect(page.getByLabel("Endpoint URL")).toBeFocused();
  await page.keyboard.type("https://app.example.com/login?next=");
  await page.getByRole("button", { name: "HTTP method" }).click();
  await page.getByRole("menuitem", { name: "GET" }).click();
  await expect(page.getByRole("button", { name: "HTTP method" })).toHaveText("GET");

  await page.getByRole("button", { name: "Remove Endpoint" }).click();
  await expect(page.getByLabel("Endpoint URL")).toHaveCount(0);
});

test("the PDF is a clean report: no Markdown, no watermark", async ({ page }) => {
  await newProject(page);
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

  await page.getByRole("button", { name: "Add property" }).click();
  await page.getByRole("menuitem", { name: /Endpoint/ }).click();
  await page.keyboard.type("https://app.example.com/api/invoices/{id}");

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
