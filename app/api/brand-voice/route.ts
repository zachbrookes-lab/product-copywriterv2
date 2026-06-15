import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/anthropic";

export const maxDuration = 90;

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

  return text.slice(0, 15000);
}

interface MarketContext {
  toneVsMarket: string;
  vocabularyVsMarket: string;
  titleStyleVsMarket: string;
  notesVsMarket: string;
  fullContext: string;
  technicalCasualPosition: number; // 0-4, 0 = most technical, 4 = most casual
  restrainedBoldPosition: number; // 0-4, 0 = most restrained, 4 = most bold
  technicalCasualMarkers: string[]; // 5 short labels
  restrainedBoldMarkers: string[]; // 5 short labels
}

async function analyzeMarketContext(
  client: ReturnType<typeof getClient>,
  productCategory: string,
  profile: Record<string, string>
): Promise<MarketContext | null> {
  const prompt = `You are a brand strategist researching a competitive market. A brand competes in this category: "${productCategory}".

Their current brand voice:
- Tone: ${profile.toneDescriptors}
- Vocabulary: ${profile.vocabulary}
- Sentence style: ${profile.sentenceStyle}
- Title style: ${profile.titleStyle}
- Notes: ${profile.notes}

Use web search to research how OTHER brands in this category write their marketing and product copy (tone, vocabulary, title conventions). Look at a range, from more technical/restrained/engineering-led brands to more casual/playful/value-driven brands, and anything in between.

Then produce:

1. Brief "vs market" notes (1 short sentence each, for a UI summary) for: tone, vocabulary, title style, and general notes. Each should briefly say how this brand's approach compares to what's typical in the category (e.g. "More casual and benefit-led than most technical competitors, who lean on spec lists.").

2. A fuller "fullContext" paragraph (4-6 sentences) synthesizing the competitive voice landscape in this category in more depth, for use as hidden context by an AI copywriter (not shown to the user directly).

3. Two positioning sliders describing the range of voices seen in this category:
   - technicalCasual: a spectrum from highly technical/spec-led/engineering language (0) to casual/playful/conversational language (4). Provide 5 short marker labels (one per position, each 1-3 words) describing what each position sounds like in this category, and indicate which position (0-4) this brand's CURRENT voice most closely matches.
   - restrainedBold: a spectrum from restrained/minimal/premium-understated (0) to bold/hype-driven/energetic (4). Provide 5 short marker labels and indicate which position (0-4) this brand's CURRENT voice most closely matches.

Respond ONLY with a JSON object (no markdown, no preamble) with exactly these fields:
{
  "toneVsMarket": "...",
  "vocabularyVsMarket": "...",
  "titleStyleVsMarket": "...",
  "notesVsMarket": "...",
  "fullContext": "...",
  "technicalCasualMarkers": ["label0", "label1", "label2", "label3", "label4"],
  "technicalCasualPosition": 0,
  "restrainedBoldMarkers": ["label0", "label1", "label2", "label3", "label4"],
  "restrainedBoldPosition": 0
}`;

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
  if (!match) return null;

  let cleaned = match[0].trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");

  try {
    const parsed = JSON.parse(cleaned);
    return {
      toneVsMarket: String(parsed.toneVsMarket ?? ""),
      vocabularyVsMarket: String(parsed.vocabularyVsMarket ?? ""),
      titleStyleVsMarket: String(parsed.titleStyleVsMarket ?? ""),
      notesVsMarket: String(parsed.notesVsMarket ?? ""),
      fullContext: String(parsed.fullContext ?? ""),
      technicalCasualMarkers: Array.isArray(parsed.technicalCasualMarkers)
        ? parsed.technicalCasualMarkers.slice(0, 5).map(String)
        : ["Technical", "Specific", "Balanced", "Friendly", "Casual"],
      technicalCasualPosition: clampPosition(parsed.technicalCasualPosition),
      restrainedBoldMarkers: Array.isArray(parsed.restrainedBoldMarkers)
        ? parsed.restrainedBoldMarkers.slice(0, 5).map(String)
        : ["Restrained", "Understated", "Balanced", "Confident", "Bold"],
      restrainedBoldPosition: clampPosition(parsed.restrainedBoldPosition),
    };
  } catch {
    return null;
  }
}

function clampPosition(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return 2;
  return Math.min(4, Math.max(0, Math.round(n)));
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { productCategory: _pc, brandTargetAudience: _bta, ...editableProfile } = profile;

    let marketContext: MarketContext | null = null;
    if (productCategory) {
      try {
        marketContext = await analyzeMarketContext(client, productCategory, editableProfile);
      } catch {
        marketContext = null;
      }
    }

    return NextResponse.json({
      profile: editableProfile,
      sourceUrl: normalizedUrl,
      productCategory,
      brandTargetAudience,
      marketContext,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
