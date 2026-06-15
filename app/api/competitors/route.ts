import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/anthropic";
import { BrandVoiceProfile, ProductInput } from "@/lib/types";

export const maxDuration = 90;

interface CompetitorOption {
  name: string;
  productName: string;
  productUrl: string;
  mainPoints: string[];
  voiceDescription: string;
  blendInstruction: string;
}

function buildPrompt(
  product: ProductInput,
  voice: BrandVoiceProfile,
  brandTargetAudience: string,
  productCategory: string
) {
  const featuresList = product.features
    .map((f, i) => `${i + 1}. ${f.feature}: ${f.benefit}`)
    .join("\n");

  return `You are a competitive research analyst helping an e-commerce brand position a product.

BRAND TONE (for context): ${voice.toneDescriptors}
BRAND TARGET AUDIENCE: ${brandTargetAudience}
PRODUCT CATEGORY: ${productCategory}

THIS PRODUCT:
Name: ${product.productName}
SKU: ${product.sku}
Features:
${featuresList}

STEP 1: First, write a 2-3 sentence productTargetAudience describing who specifically buys THIS product, based on its features (this may be more specific/different than the general brand audience above).

STEP 2: Use web search to find 2-3 real, currently-sold competitor products that target a similar audience to the productTargetAudience you wrote (look for direct competitors to "${product.productName}" or similar products in "${productCategory}"). For each competitor product found:
- Get its product name and a direct URL to its product detail page
- Identify 2-4 main selling points / claims from that product's page (paraphrase, do not quote verbatim)
- Characterize how that product's page talks about it (tone/voice: e.g. more technical/restrained, more playful, more premium/minimal, more value-driven)
- Write a brand-agnostic, 1-2 sentence instruction describing how blending that competitor's stylistic traits into our brand voice would change our copy (concrete and actionable, do not require knowing the competitor's name to apply)

Respond ONLY with a single JSON object (no markdown, no preamble, no code fences) with exactly these keys:
{
  "productTargetAudience": "...",
  "competitors": [
    {
      "name": "Competitor brand/product short name",
      "productName": "Full product name found",
      "productUrl": "Direct URL to the product page",
      "mainPoints": ["point 1", "point 2", "point 3"],
      "voiceDescription": "1 sentence characterizing how this competitor's page talks about the product",
      "blendInstruction": "1-2 sentence brand-agnostic style instruction as described above"
    }
  ]
}

Include 2-3 items in "competitors". If you cannot find real competitor product pages, return an empty array for "competitors" rather than inventing URLs.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product: ProductInput = body.product;
    const voice: BrandVoiceProfile = body.voice;
    const brandTargetAudience: string = body.brandTargetAudience ?? "";
    const productCategory: string = body.productCategory ?? "";

    if (!product || !voice) {
      return NextResponse.json(
        { error: "Missing product or voice in request body" },
        { status: 400 }
      );
    }

    const client = getClient();
    const prompt = buildPrompt(product, voice, brandTargetAudience, productCategory);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
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

    let result: {
      productTargetAudience?: string;
      competitors?: CompetitorOption[];
    };
    try {
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Could not parse competitor research as JSON", raw: cleaned },
        { status: 500 }
      );
    }

    const competitors = Array.isArray(result.competitors)
      ? result.competitors
          .filter(
            (c) =>
              c &&
              typeof c.name === "string" &&
              typeof c.productUrl === "string" &&
              typeof c.blendInstruction === "string"
          )
          .slice(0, 3)
      : [];

    return NextResponse.json({
      productTargetAudience: result.productTargetAudience ?? "",
      competitors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
