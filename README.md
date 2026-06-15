# Product Copywriter

A web app that generates on-brand product copy from your product data — long
descriptions, per-feature copy, a premium image headline, target audience
profiles, and content ideas for blogs and educational articles.

## How it works

1. **Brand voice** — enter your store's URL. The app fetches the page and
   uses Claude to synthesize a brand voice profile (tone, vocabulary,
   sentence style, themes, title style). You can edit any of these fields
   before generating copy.

2. **Product data** — upload an Excel file with these columns (one row per
   feature):
   - `SKU`
   - `Product Description` (the product name)
   - `Features`
   - `Benefits`

   All rows with the same SKU are grouped into one product.

3. **Generate** — Claude generates, in your brand voice:
   - A long-form product description
   - A title + short description for each feature
   - A short headline for premium content images
   - A brand-level target audience summary
   - A product-level target audience summary
   - 5 blog content ideas
   - 5 educational article ideas (about the underlying technology)

4. **Review & export** — edit any generated text inline, then export to
   Excel (`.xlsx`) or Word (`.docx`).

## Local setup

### Requirements

- Node.js 18.18+ (Node 20 LTS recommended)
- An Anthropic API key from https://console.anthropic.com (this is separate
  from a claude.ai subscription and uses pay-as-you-go billing — typically a
  few cents per product generated)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Add your API key
cp .env.local.example .env.local
# then edit .env.local and paste your key:
# ANTHROPIC_API_KEY=sk-ant-...

# 3. Run the dev server
npm run dev
```

Open http://localhost:3000

## Deploying to Vercel (recommended)

Vercel has a generous free tier and deploys this kind of app with zero
configuration.

1. Push this folder to a GitHub repository (or use Vercel's CLI / drag-and-drop
   deploy — see https://vercel.com/docs).
2. Go to https://vercel.com, sign up (free), and click **Add New Project**.
3. Import the repository.
4. Before deploying, expand **Environment Variables** and add:
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com
5. Click **Deploy**.

After a couple of minutes you'll get a URL like `your-app.vercel.app` that
your team can use directly. Each teammate just opens that URL — no further
setup needed.

## Notes & known limitations (v1)

- Processes **one product at a time** (batch processing across an entire
  Excel file is a planned next step).
- Brand voice analysis fetches and reads the **homepage text** of the URL
  you provide — for best results, you may want to try a few different pages
  (homepage, About page, a product page) and compare profiles.
- The app does not write back to Shopify directly — export to Excel/Word and
  copy into your Shopify admin. Direct Shopify integration (via the Admin
  API) is a possible future addition.
- Generated copy should be reviewed before publishing — Claude is instructed
  to avoid inventing specs not present in your data, but human review is
  still recommended for accuracy and brand fit.

## Cost estimate

Using Claude Sonnet 4.6 at standard API rates, generating the full output set
for one product costs roughly **$0.03–0.06** per run. Brand voice analysis
(step 1, no search) is a separate, smaller call (~$0.01 or less).

Two steps use web search and cost more, scaling with how many searches the
model runs:
- **"Analyze market positioning"** (step 1, optional/opt-in): not run
  automatically. Click it only if you want the technical/casual and
  restrained/bold sliders. Roughly **$0.02–0.04** per brand (one-time, not
  per product).
- **"Research audience & competitors"** (step 3): roughly **$0.02–0.04** per
  product. Competitor cards no longer include images or prices, which
  reduces search volume for this step.

### A note on timeouts

Vercel's free (Hobby) plan caps serverless function duration at 60 seconds.
Web-search-heavy steps occasionally approach this limit. If you see an error
about an unexpected response or a timeout, wait a moment and try again, the
underlying API call may still succeed on a retry.

### Cheaper testing with Haiku

To reduce costs while testing (e.g. iterating on prompts or UI), set the
`ANTHROPIC_MODEL` environment variable to `claude-haiku-4-5-20251001` in
`.env.local` (or in Vercel's environment variables). Haiku is roughly a third
of Sonnet's cost. Output quality and adherence to the brand voice/writing
rules will be noticeably lower with Haiku, so switch back to
`claude-sonnet-4-6` (or remove the variable, which is the default) for
production-quality output.
