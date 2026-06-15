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

// Override with the ANTHROPIC_MODEL environment variable to switch models
// without code changes. Useful for cheaper testing, e.g. set
// ANTHROPIC_MODEL=claude-haiku-4-5-20251001 for lower-cost runs.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
