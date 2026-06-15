import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
} from "docx";
import { GeneratedCopy, ProductInput } from "@/lib/types";

export const maxDuration = 60;

const FONT = "Arial";

// Spacing values are in twentieths of a point (DXA). 240 DXA = 12pt.
const SPACING_AFTER_PARAGRAPH = 200;
const SPACING_AFTER_HEADING = 160;
const SPACING_BEFORE_SECTION = 320;
const SPACING_AFTER_SECTION_RULE = 240;

function buildWorkbook(product: ProductInput, copy: GeneratedCopy): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Overview sheet
  const overviewRows = [
    ["SKU", product.sku],
    ["Product Name", product.productName],
    [],
    ["Long Description", copy.longDescription],
    [],
    ["Premium Image Headline", copy.premiumHeadline],
    [],
    ["Brand Target Audience", copy.brandTargetAudience],
    [],
    ["Product Target Audience", copy.productTargetAudience],
  ];
  const overviewSheet = XLSX.utils.aoa_to_sheet(overviewRows);
  overviewSheet["!cols"] = [{ wch: 24 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, overviewSheet, "Overview");

  // Feature copy sheet
  const featureRows = [
    ["Feature", "Title", "Description"],
    ...copy.featureCopy.map((f) => [f.feature, f.title, f.description]),
  ];
  const featureSheet = XLSX.utils.aoa_to_sheet(featureRows);
  featureSheet["!cols"] = [{ wch: 35 }, { wch: 40 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, featureSheet, "Feature Copy");

  // Content ideas sheet
  const contentRows = [
    ["Type", "Title"],
    ...copy.blogIdeas.map((idea) => ["Blog Post", idea]),
    ...copy.educationalArticles.map((idea) => ["Educational Article", idea]),
  ];
  const contentSheet = XLSX.utils.aoa_to_sheet(contentRows);
  contentSheet["!cols"] = [{ wch: 20 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, contentSheet, "Content Ideas");

  return wb;
}

async function buildDocx(product: ProductInput, copy: GeneratedCopy): Promise<Buffer> {
  const children: Paragraph[] = [];

  // --- Helper builders -----------------------------------------------

  function title(text: string) {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 56, font: FONT })],
      spacing: { after: SPACING_AFTER_HEADING },
    });
  }

  function sectionHeading(text: string, isFirst = false) {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 32, font: FONT })],
      spacing: {
        before: isFirst ? 0 : SPACING_BEFORE_SECTION,
        after: SPACING_AFTER_HEADING,
      },
    });
  }

  function subHeading(text: string) {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 26, font: FONT })],
      spacing: { before: SPACING_AFTER_PARAGRAPH, after: 80 },
    });
  }

  function body(text: string) {
    return new Paragraph({
      children: [new TextRun({ text, font: FONT, size: 22 })],
      spacing: { after: SPACING_AFTER_PARAGRAPH },
    });
  }

  // A horizontal rule with space above and below, used between major sections
  function sectionDivider() {
    return new Paragraph({
      children: [],
      spacing: { before: SPACING_BEFORE_SECTION, after: SPACING_AFTER_SECTION_RULE },
      border: {
        bottom: {
          color: "CCCCCC",
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
    });
  }

  // --- Document content ------------------------------------------------

  children.push(title(`${product.productName} (${product.sku})`));

  // Long Description
  children.push(sectionHeading("Long Description", true));
  copy.longDescription
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .forEach((para) => children.push(body(para)));

  children.push(sectionDivider());

  // Premium Image Headline
  children.push(sectionHeading("Premium Image Headline"));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: copy.premiumHeadline, bold: true, size: 32, font: FONT })],
      spacing: { after: SPACING_AFTER_PARAGRAPH },
    })
  );

  children.push(sectionDivider());

  // Feature Copy
  children.push(sectionHeading("Feature Copy"));
  copy.featureCopy.forEach((f) => {
    children.push(subHeading(f.title));
    children.push(body(f.description));
  });

  children.push(sectionDivider());

  // Brand Target Audience
  children.push(sectionHeading("Brand Target Audience"));
  children.push(body(copy.brandTargetAudience));

  children.push(sectionDivider());

  // Product Target Audience
  children.push(sectionHeading("Product Target Audience"));
  children.push(body(copy.productTargetAudience));

  children.push(sectionDivider());

  // Suggested Blog Content
  children.push(sectionHeading("Suggested Blog Content (5)"));
  copy.blogIdeas.forEach((idea, i) => children.push(body(`${i + 1}. ${idea}`)));

  children.push(sectionDivider());

  // Suggested Educational Articles
  children.push(sectionHeading("Suggested Educational Articles (5)"));
  copy.educationalArticles.forEach((idea, i) => children.push(body(`${i + 1}. ${idea}`)));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22 },
        },
      },
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product: ProductInput = body.product;
    const copy: GeneratedCopy = body.copy;
    const format: "xlsx" | "docx" = body.format;

    if (!product || !copy || !format) {
      return NextResponse.json(
        { error: "Missing product, copy, or format" },
        { status: 400 }
      );
    }

    const safeName = product.sku.replace(/[^a-zA-Z0-9_-]/g, "_") || "product";

    if (format === "xlsx") {
      const wb = buildWorkbook(product, copy);
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${safeName}_copy.xlsx"`,
        },
      });
    } else if (format === "docx") {
      const buf = await buildDocx(product, copy);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${safeName}_copy.docx"`,
        },
      });
    } else {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
