import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/anthropic";
import { BrandVoiceProfile, ProductInput } from "@/lib/types";

export const maxDuration = 120;

function buildPrompt(product: ProductInput, voice: BrandVoiceProfile) {
  const featuresList = product.features
    .map(
      (f, i) =>
        `${i + 1}. FEATURE: ${f.feature}\n   BENEFIT/DETAIL: ${f.benefit}`
    )
    .join("\n\n");

  return `You are an expert e-commerce copywriter. Write product marketing copy that matches the brand voice profile below EXACTLY, and is factually grounded in the product data provided. Do not invent specs, numbers, or claims that are not supported by the product data or by well-established facts about the underlying technology.

BRAND VOICE PROFILE:
- Tone: ${voice.toneDescriptors}
- Vocabulary to favor: ${voice.vocabulary}
- Sentence style: ${voice.sentenceStyle}
- Recurring themes: ${voice.recurringThemes}
- Title style: ${voice.titleStyle}
- Additional notes: ${voice.notes}

PRODUCT:
SKU: ${product.sku}
Product Name: ${product.productName}

FEATURES & BENEFITS:
${featuresList}

TASK:
Generate the following, all written in the brand voice above:

1. longDescription: A long-form product description (4-7 short paragraphs) weaving together the features and benefits into a cohesive narrative.

2. featureCopy: An array with one object per feature listed above (same order), each with:
   - feature: the original feature name
   - title: a short punchy marketing title for this feature (in brand voice/title style)
   - description: a 1-3 sentence description of this feature for product detail pages

3. premiumHeadline: A very short (3-6 word) punchy headline suitable for overlay text on a premium lifestyle/hero image.

4. brandTargetAudience: 2-3 sentences describing the overall brand's target audience based on the voice profile and themes.

5. productTargetAudience: 2-3 sentences describing the specific target audience for THIS product based on its features.

6. blogIdeas: An array of exactly 5 blog post title ideas relevant to this product's use cases, technology, and audience.

7. educationalArticles: An array of exactly 5 educational/technical deep-dive article title ideas about the underlying technology in this product (e.g. explaining standards, specs, or how things work).

Respond ONLY with a single JSON object (no markdown formatting, no preamble, no code fences) with exactly these keys: longDescription, featureCopy, premiumHeadline, brandTargetAudience, productTargetAudience, blogIdeas, educationalArticles.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product: ProductInput = body.product;
    const voice: BrandVoiceProfile = body.voice;

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
    const prompt = buildPrompt(product, voice);

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

    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
