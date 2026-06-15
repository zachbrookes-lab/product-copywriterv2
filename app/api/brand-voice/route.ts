import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/anthropic";

export const maxDuration = 60;

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; BrandVoiceBot/1.0; +copywriting-tool)",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  // Strip script/style tags and HTML tags to get rough text content
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-zA-Z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Cap to a reasonable size to control token usage
  return text.slice(0, 15000);
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    let pageText: string;
    try {
      pageText = await fetchPageText(normalizedUrl);
    } catch (err) {
      return NextResponse.json(
        {
          error: `Could not fetch the site. ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        },
        { status: 422 }
      );
    }

    if (!pageText || pageText.length < 100) {
      return NextResponse.json(
        {
          error:
            "Fetched page had little to no readable text. Try a different page (e.g. an About or product page).",
        },
        { status: 422 }
      );
    }

    const client = getClient();

    const prompt = `You are a brand voice analyst. Below is raw text scraped from a brand's website homepage. Analyze it and synthesize a brand voice profile.

WEBSITE TEXT:
"""
${pageText}
"""

Respond ONLY with a JSON object (no markdown, no preamble) with exactly these fields, each a string:
{
  "toneDescriptors": "3-6 adjectives describing the overall tone (e.g. confident, friendly, technical)",
  "vocabulary": "Comma-separated list of distinctive words/phrases this brand uses repeatedly",
  "sentenceStyle": "1-2 sentences describing typical sentence structure and rhythm (e.g. short punchy headlines followed by spec-driven detail)",
  "recurringThemes": "Comma-separated list of recurring themes/values (e.g. sustainability, speed, simplicity, AI-readiness)",
  "titleStyle": "1-2 sentences describing how product/feature titles tend to be written",
  "notes": "Any other notable observations about the brand voice",
  "brandTargetAudience": "2-3 sentences describing the overall brand's target audience based on this content",
  "productCategory": "A short (3-8 word) description of the primary product category/market this brand competes in, suitable for searching for competitors (e.g. 'USB-C docks and charging accessories')"
}`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
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

    let profile;
    try {
      profile = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Could not parse brand voice profile from model response" },
        { status: 500 }
      );
    }

    const productCategory: string =
      typeof profile.productCategory === "string" ? profile.productCategory.trim() : "";
    const brandTargetAudience: string =
      typeof profile.brandTargetAudience === "string" ? profile.brandTargetAudience.trim() : "";

    // Remove fields that aren't part of the editable voice profile shape
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { productCategory: _pc, brandTargetAudience: _bta, ...editableProfile } = profile;

    return NextResponse.json({
      profile: editableProfile,
      sourceUrl: normalizedUrl,
      productCategory,
      brandTargetAudience,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
