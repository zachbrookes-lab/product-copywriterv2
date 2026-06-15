import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/anthropic";
import { CompetitorProduct, ProductInput } from "@/lib/types";

export const maxDuration = 60;

function buildPrompt(
  product: ProductInput,
  productCategory: string,
  productTargetAudience: string
) {
  return `You are a competitive research analyst.

THIS PRODUCT: ${product.productName}
PRODUCT CATEGORY: ${productCategory}
TARGET AUDIENCE: ${productTargetAudience}

Use a SMALL number of web searches (1-2 total) to find up to 3 real, currently-sold competitor products that target a similar audience (direct competitors to "${product.productName}" or similar products in "${productCategory}").

For each:
- name: short competitor/brand name
- productName: full product name
- productUrl: direct URL to the product detail page
- summary: 2-3 sentence summary of the product in your own words (paraphrase, do not quote verbatim)
- keyFeatures: 3-5 bullet points of its key features/claims (paraphrase)

Respond ONLY with a single JSON object (no markdown, no preamble, no code fences):
{
  "competitors": [
    {
      "name": "...",
      "productName": "...",
      "productUrl": "https://...",
      "summary": "...",
      "keyFeatures": ["...", "..."]
    }
  ]
}

Include up to 3 items (2 minimum if possible). If you cannot find real product pages, return fewer items rather than inventing URLs.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product: ProductInput = body.product;
    const productCategory: string = body.productCategory ?? "";
    const productTargetAudience: string = body.productTargetAudience ?? "";

    if (!product) {
      return NextResponse.json(
        { error: "Missing product in request body" },
        { status: 400 }
      );
    }

    const client = getClient();
    const prompt = buildPrompt(product, productCategory, productTargetAudience);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
        },
      ],
    });

    const textBlocks = response.content.filter((b) => b.type === "text");
    const combinedText = textBlocks
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    const match = combinedText.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json(
        { error: "No JSON object found in model response" },
        { status: 500 }
      );
    }

    let cleaned = match[0].trim();
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");

    let result: { competitors?: Partial<CompetitorProduct>[] };
    try {
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Could not parse competitor research as JSON", raw: cleaned },
        { status: 500 }
      );
    }

    const competitors: CompetitorProduct[] = Array.isArray(result.competitors)
      ? result.competitors
          .filter(
            (c): c is CompetitorProduct =>
              !!c && typeof c.name === "string" && typeof c.productUrl === "string"
          )
          .map((c) => ({
            name: c.name!,
            productName: c.productName ?? "",
            productUrl: c.productUrl!,
            summary: c.summary ?? "",
            keyFeatures: Array.isArray(c.keyFeatures) ? c.keyFeatures.filter((f) => typeof f === "string") : [],
          }))
          .slice(0, 3)
      : [];

    return NextResponse.json({ competitors });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
