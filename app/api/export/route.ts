import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
} from "docx";
import { GeneratedCopy, ProductInput } from "@/lib/types";

export const maxDuration = 60;

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

  children.push(
    new Paragraph({
      text: `${product.productName} (${product.sku})`,
      heading: HeadingLevel.TITLE,
    })
  );

  children.push(
    new Paragraph({ text: "Long Description", heading: HeadingLevel.HEADING_1 })
  );
  copy.longDescription.split("\n").forEach((para) => {
    if (para.trim()) {
      children.push(new Paragraph({ text: para.trim() }));
    }
  });

  children.push(
    new Paragraph({ text: "Premium Image Headline", heading: HeadingLevel.HEADING_1 })
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: copy.premiumHeadline, bold: true, size: 32 })],
    })
  );

  children.push(
    new Paragraph({ text: "Feature Copy", heading: HeadingLevel.HEADING_1 })
  );
  copy.featureCopy.forEach((f) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: f.title, bold: true })],
        heading: HeadingLevel.HEADING_2,
      })
    );
    children.push(new Paragraph({ text: f.description }));
  });

  children.push(
    new Paragraph({ text: "Brand Target Audience", heading: HeadingLevel.HEADING_1 })
  );
  children.push(new Paragraph({ text: copy.brandTargetAudience }));

  children.push(
    new Paragraph({ text: "Product Target Audience", heading: HeadingLevel.HEADING_1 })
  );
  children.push(new Paragraph({ text: copy.productTargetAudience }));

  children.push(
    new Paragraph({ text: "Suggested Blog Content (5)", heading: HeadingLevel.HEADING_1 })
  );
  copy.blogIdeas.forEach((idea, i) => {
    children.push(new Paragraph({ text: `${i + 1}. ${idea}` }));
  });

  children.push(
    new Paragraph({ text: "Suggested Educational Articles (5)", heading: HeadingLevel.HEADING_1 })
  );
  copy.educationalArticles.forEach((idea, i) => {
    children.push(new Paragraph({ text: `${i + 1}. ${idea}` }));
  });

  const doc = new Document({
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
