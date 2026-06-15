import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/anthropic";
import { analyzeMarketContext } from "@/lib/marketContext";
import { BrandVoiceProfile } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const productCategory: string = body.productCategory ?? "";
    const profile: BrandVoiceProfile = body.profile;

    if (!productCategory || !profile) {
      return NextResponse.json(
        { error: "Missing productCategory or profile in request body" },
        { status: 400 }
      );
    }

    const client = getClient();
    const { toneDescriptors, vocabulary, sentenceStyle, recurringThemes, titleStyle, notes } = profile;
    const marketContext = await analyzeMarketContext(client, productCategory, {
      toneDescriptors,
      vocabulary,
      sentenceStyle,
      recurringThemes,
      titleStyle,
      notes,
    });

    if (!marketContext) {
      return NextResponse.json(
        { error: "Could not analyze market context. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ marketContext });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
