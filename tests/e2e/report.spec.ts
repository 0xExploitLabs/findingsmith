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

test("severity follows the CVSS score: 5.3 is Medium", async ({ page }) => {
  await newProject(page);
  await page.getByRole("button", { name: "Add finding" }).click();
  await page.getByRole("menuitem", { name: /Blank finding/ }).click();
  await page.getByLabel("Title").fill("Verbose error messages");

  await page.getByRole("button", { name: "Add CVSS score" }).click();
  const vector = page.getByLabel("Vector");
  await vector.fill("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N");
  await vector.press("Enter");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.getByRole("button", { name: "Edit CVSS score" })).toContainText("5.3");
  await expect(page.locator("dd").first()).toContainText("Medium");
  await expect(page.locator("dd").first()).toContainText("from the CVSS score");
});

test("an override shows both ratings and needs a reason", async ({ page }) => {
  await newProject(page);
  await page.getByRole("button", { name: "Browse the library" }).click();
  await page.getByLabel("Search the library").fill("IDOR");
  await page.getByRole("dialog").getByRole("button", { name: "Add finding" }).click();
  await expect(page.locator("dd").first()).toContainText("Medium");

  await page.getByRole("button", { name: "Override" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^High/ }).click();
  const save = dialog.getByRole("button", { name: "Save override" });
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Reason").fill("Invoices include full card holder addresses.");
  await save.click();

  await expect(page.locator("dd").first()).toContainText("High");
  await expect(page.locator("dd").first()).toContainText("adjusted from Medium");
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
  expect(text).toContain("Kestrel Security");
  for (const markup of ["**", "```", "## ", "asset:", "](http"]) {
    expect(text, `raw Markdown "${markup}" in the PDF`).not.toContain(markup);
  }
  // The document properties carry the author's name, not the tool's.
  expect(info.Producer).toBe("Kestrel Security");
  expect(info.Creator).toBe("Kestrel Security");
  expect(JSON.stringify(info)).not.toMatch(/react-pdf|debrief/i);
});
