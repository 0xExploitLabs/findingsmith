import { pdf } from "@react-pdf/renderer";
import { assetIdsIn, blobToDataUrl } from "../data/assets";
import { getAsset } from "../data/db";
import type { Finding, Project } from "../domain/types";
import type { PdfImage } from "./markdown";
import { type PageMap, ReportDocument, type ReportInput } from "./Report";
import { registerFonts } from "./theme";

async function loadImage(id: string): Promise<PdfImage | null> {
  const asset = await getAsset(id);
  if (!asset) return null;
  return { src: await blobToDataUrl(asset.blob), width: asset.width, height: asset.height };
}

async function collectInput(project: Project, findings: Finding[]): Promise<ReportInput> {
  const markdown = [project.body, ...findings.map((f) => f.body)].join("\n");
  const images = new Map<string, PdfImage>();
  await Promise.all(
    [...new Set(assetIdsIn(markdown))].map(async (id) => {
      const img = await loadImage(id);
      if (img) images.set(id, img);
    }),
  );
  const logo = project.logoAssetId ? await loadImage(project.logoAssetId) : null;
  return { project, findings, images, logo };
}

/**
 * Renders the report to a PDF file. Laid out twice: the first pass records
 * the page each section lands on, the second prints those numbers in the
 * contents. The contents page has the same lines in both passes, so the
 * numbers cannot shift between them.
 */
export async function renderReport(project: Project, findings: Finding[]): Promise<Blob> {
  registerFonts();
  const input = await collectInput(project, findings);
  const firstPass: PageMap = {};
  await pdf(<ReportDocument input={input} pages={{}} collect={firstPass} />).toBlob();
  const secondPass: PageMap = {};
  return pdf(<ReportDocument input={input} pages={firstPass} collect={secondPass} />).toBlob();
}
