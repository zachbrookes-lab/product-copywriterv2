import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/anthropic";
import { BrandVoiceProfile, ProductInput } from "@/lib/types";

export const maxDuration = 120;

function buildPrompt(
  product: ProductInput,
  voice: BrandVoiceProfile,
  brandTargetAudience: string,
  productTargetAudience: string,
  marketContextFull: string
) {
  const featuresList = product.features
    .map(
      (f, i) =>
        `${i + 1}. FEATURE: ${f.feature}\n   BENEFIT/DETAIL: ${f.benefit}`
    )
    .join("\n\n");

  const styleAdjustmentSection = voice.styleAdjustment?.trim()
    ? `\nSTYLE ADJUSTMENT:\n${voice.styleAdjustment.trim()}\nApply this adjustment on top of the brand voice above rather than replacing it. The result should still sound like this brand, shifted in the direction described.\n`
    : "";

  const marketSection = marketContextFull?.trim()
    ? `\nCOMPETITIVE VOICE LANDSCAPE (context only, do not reference competitors by name in the output):\n${marketContextFull.trim()}\n`
    : "";

  return `You are an expert e-commerce copywriter. Write product marketing copy that matches the brand voice profile below, and is factually grounded in the product data provided. Do not invent specs, numbers, or claims that are not supported by the product data or by well-established facts about the underlying technology.

BRAND VOICE PROFILE:
- Tone: ${voice.toneDescriptors}
- Vocabulary to favor: ${voice.vocabulary}
- Sentence style: ${voice.sentenceStyle}
- Recurring themes: ${voice.recurringThemes}
- Title style: ${voice.titleStyle}
- Additional notes: ${voice.notes}
${styleAdjustmentSection}${marketSection}
BRAND TARGET AUDIENCE: ${brandTargetAudience}
PRODUCT TARGET AUDIENCE: ${productTargetAudience}

PRODUCT:
SKU: ${product.sku}
Product Name: ${product.productName}

FEATURES & BENEFITS:
${featuresList}

WRITING RULES (apply to all generated text):
- Never use em dashes (—) or en dashes used as punctuation. Use periods, commas, or restructure the sentence instead.
- Avoid filler intensifiers and stock AI phrases: "blazing-fast", "seamless", "razor-sharp", "elevate", "unlock", "game-changing", "cutting-edge", "definitive", "unparalleled", "robust". If a claim needs a number or spec, use that instead of an adjective.
- Avoid the "no X required" / "without the need for Y" construction more than once across the entire output. Vary how you express "this replaces something else."
- Do not end the long description, or any section, with a tagline-style summary sentence that just restates the product's value (e.g. "This is the X your workflow has been waiting for"). End on a concrete detail or a plain, low-key closing instead.
- Avoid repeating the same three-item list structure ("X, Y, and Z") more than once or twice across the whole output. Vary list lengths and how items are joined.
- For featureCopy titles specifically: lead with the spec, number, or named technology where relevant (specs and technology names should be easy to find by both readers and search/AI systems). But vary the GRAMMATICAL STRUCTURE of titles across the set, no single repeating pattern. Mix: a bare spec/name ("120Gbps Thunderbolt 5"), a full sentence with the spec as subject ("80Gbps on Every USB-C Port"), a spec plus use case ("M.2 PCIe Gen 4 x4 for Storage or AI Modules"), a comparison/alternative framing ("Three 4K Displays, or One at 8K 144Hz"), etc. No two consecutive titles should follow the same template.
- For blogIdeas and educationalArticles: vary title structure too. Don't make every title follow an "X: Y" colon pattern, mix in questions, plain statements, "how to" phrasing, and direct claims.
- Vary sentence and paragraph openers throughout. Don't start multiple paragraphs or sections with the same grammatical pattern (e.g. don't open every paragraph with a short fragment followed by elaboration).
- longDescription must be SHORT: 2-3 paragraphs maximum, even if the product has many features. Be judicious about which features make it into prose versus being left to featureCopy. Prioritize concrete, quotable sound bites (specific numbers, named technologies, clear capability statements) that read well on their own if extracted, e.g. by AI assistants or search snippets, over broad scene-setting language. Every sentence should earn its place; cut anything that's purely atmospheric.

TASK:
Generate the following, all written in the brand voice above (with any style adjustment applied) and following the writing rules. Use the brand and product target audiences, and the competitive voice landscape, as context to inform the copy, but do not restate them verbatim and do not mention competitors directly.

1. longDescription: A SHORT product description (2-3 paragraphs maximum) weaving together the most important features and benefits into a cohesive narrative, written in clear, sound-bite-friendly language.

2. featureCopy: An array with one object per feature listed above (same order), each with:
   - feature: the original feature name
   - title: a title for this feature following the title guidance above (spec-led, structurally varied)
   - description: a 1-3 sentence description of this feature for product detail pages

3. premiumHeadline: A very short (3-6 word) headline suitable for overlay text on a premium lifestyle/hero image.

4. blogIdeas: An array of exactly 5 blog post title ideas relevant to this product's use cases, technology, and audience.

5. educationalArticles: An array of exactly 5 educational/technical deep-dive article title ideas about the underlying technology in this product (e.g. explaining standards, specs, or how things work).

Respond ONLY with a single JSON object (no markdown formatting, no preamble, no code fences) with exactly these keys: longDescription, featureCopy, premiumHeadline, blogIdeas, educationalArticles.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product: ProductInput = body.product;
    const voice: BrandVoiceProfile = body.voice;
    const brandTargetAudience: string = body.brandTargetAudience ?? "";
    const productTargetAudience: string = body.productTargetAudience ?? "";
    const marketContextFull: string = body.marketContextFull ?? "";

    if (!product || !voice) {
      return NextResponse.json(
        { error: "Missing product or voice in request body" },
        { status: 400 }
      );
    }

    if (!product.features || product.features.length === 0) {
      return NextResponse.json(
        { error: "Product has no features" },
        { status: 400 }
      );
    }

    const client = getClient();
    const prompt = buildPrompt(product, voice, brandTargetAudience, productTargetAudience, marketContextFull);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text response from model" },
        { status: 500 }
      );
    }

    let cleaned = textBlock.text.trim();
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        {
          error: "Could not parse generated copy as JSON",
          raw: cleaned,
        },
        { status: 500 }
      );
    }

    // Merge in the audiences that were generated/confirmed earlier in the flow
    result.brandTargetAudience = brandTargetAudience;
    result.productTargetAudience = productTargetAudience;

    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
