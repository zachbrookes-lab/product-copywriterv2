import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/anthropic";
import { AudienceProfile, BrandVoiceProfile, CompetitorProduct, ProductInput } from "@/lib/types";

export const maxDuration = 120;

function buildPrompt(
  product: ProductInput,
  voice: BrandVoiceProfile,
  brandTargetAudience: string,
  productCategory: string
) {
  const featuresList = product.features
    .map((f, i) => `${i + 1}. ${f.feature}: ${f.benefit}`)
    .join("\n");

  return `You are a market research analyst helping an e-commerce brand understand a product's audience and competitive landscape.

BRAND TONE (for context): ${voice.toneDescriptors}
BRAND TARGET AUDIENCE (general): ${brandTargetAudience}
PRODUCT CATEGORY: ${productCategory}

THIS PRODUCT:
Name: ${product.productName}
SKU: ${product.sku}
Features:
${featuresList}

TASK 1: Research and describe the specific audience for THIS product.
Use web search where helpful to ground claims (e.g. industry reports, forum discussions, reviews discussing who buys/uses products like this).
Produce:
- demographics: 3-4 bullet points about who buys this (role, industry, setup type, etc.), each with a "sourceUrl" linking to a page that supports/illustrates that point (a review, forum thread, industry article, etc.)
- psychographics: 3-4 bullet points about their values, priorities, and mindset (no source needed)
- jobsToBeDone: 3-4 bullet points describing the practical tasks/goals this product helps with
- persona: a short persona description, MAXIMUM 6 sentences, giving a rough feel for who this person is (name optional, role, context, what they care about)

TASK 2: Find exactly 3 real, currently-sold competitor products that target a similar audience to the one you just described (direct competitors to "${product.productName}" or similar products in "${productCategory}"). For each:
- name: short competitor/brand name
- productName: full product name
- productUrl: direct URL to the product detail page
- imageUrl: a direct URL to a product image if you can find one (best-effort, omit or leave empty if not confidently found)
- price: the price shown on their page, as a string with currency symbol (e.g. "$249.99"), or omit if not found
- summary: 2-3 sentence summary of the product in your own words (paraphrase, do not quote verbatim)
- keyFeatures: 3-5 bullet points of its key features/claims (paraphrase)

Respond ONLY with a single JSON object (no markdown, no preamble, no code fences) with exactly these keys:
{
  "productTargetAudience": "2-3 sentence summary of who buys this product (for use elsewhere)",
  "audience": {
    "demographics": [{"point": "...", "sourceUrl": "https://..."}],
    "psychographics": ["...", "..."],
    "jobsToBeDone": ["...", "..."],
    "persona": "..."
  },
  "competitors": [
    {
      "name": "...",
      "productName": "...",
      "productUrl": "https://...",
      "imageUrl": "https://...",
      "price": "$...",
      "summary": "...",
      "keyFeatures": ["...", "..."]
    }
  ]
}

"competitors" must contain exactly 3 items if possible (2 minimum). If you cannot find real product pages, return fewer items rather than inventing URLs.`;
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
      max_tokens: 4000,
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
      audience?: Partial<AudienceProfile>;
      competitors?: Partial<CompetitorProduct>[];
    };
    try {
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Could not parse competitor research as JSON", raw: cleaned },
        { status: 500 }
      );
    }

    const audience: AudienceProfile = {
      demographics: Array.isArray(result.audience?.demographics)
        ? result.audience!.demographics!
            .filter((d) => d && typeof d.point === "string")
            .map((d) => ({ point: d.point, sourceUrl: typeof d.sourceUrl === "string" ? d.sourceUrl : undefined }))
        : [],
      psychographics: Array.isArray(result.audience?.psychographics)
        ? result.audience!.psychographics!.filter((p) => typeof p === "string")
        : [],
      jobsToBeDone: Array.isArray(result.audience?.jobsToBeDone)
        ? result.audience!.jobsToBeDone!.filter((j) => typeof j === "string")
        : [],
      persona: typeof result.audience?.persona === "string" ? result.audience!.persona! : "",
    };

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
            imageUrl: typeof c.imageUrl === "string" && c.imageUrl ? c.imageUrl : undefined,
            price: typeof c.price === "string" && c.price ? c.price : undefined,
            summary: c.summary ?? "",
            keyFeatures: Array.isArray(c.keyFeatures) ? c.keyFeatures.filter((f) => typeof f === "string") : [],
          }))
          .slice(0, 3)
      : [];

    return NextResponse.json({
      productTargetAudience: result.productTargetAudience ?? "",
      audience,
      competitors,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
