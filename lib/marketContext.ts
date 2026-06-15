import { getClient, MODEL } from "@/lib/anthropic";
import { MarketContext } from "@/lib/types";

export async function analyzeMarketContext(
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

Use a SMALL number of web searches (2-3 total) to research how OTHER brands in this category write their marketing and product copy (tone, vocabulary, title conventions). Look at a range, from more technical/restrained/engineering-led brands to more casual/playful/value-driven brands, and anything in between.

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
