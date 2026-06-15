import Anthropic from "@anthropic-ai/sdk";

export function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your .env.local file or Vercel environment variables."
    );
  }
  return new Anthropic({ apiKey });
}

export const MODEL = "claude-sonnet-4-6";
