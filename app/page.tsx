"use client";

import { useState } from "react";
import {
  AudienceProfile,
  BrandVoiceProfile,
  CompetitorProduct,
  GeneratedCopy,
  MarketContext,
  ProductInput,
} from "@/lib/types";
import { parseProductExcel } from "@/lib/excel";
import BrandVoiceEditor from "./components/BrandVoiceEditor";
import ResultsEditor from "./components/ResultsEditor";

const EMPTY_VOICE: BrandVoiceProfile = {
  toneDescriptors: "",
  vocabulary: "",
  sentenceStyle: "",
  recurringThemes: "",
  titleStyle: "",
  notes: "",
  styleAdjustment: "",
};

type StepStatus = "pending" | "active" | "done";

// Safely parse a fetch Response as JSON. If the response isn't valid JSON
// (e.g. an HTML error page from a timeout or server crash), this throws a
// readable error instead of a raw "Unexpected token" JSON parse error.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (res.status === 504 || res.status === 502) {
      throw new Error(
        "The request timed out. This step can take a while (it runs web searches) — try again, or try a more specific product/category."
      );
    }
    throw new Error(
      `Server returned an unexpected response (status ${res.status}). Please try again.`
    );
  }
}

export default function Home() {
  // Step 1: Brand voice
  const [brandUrl, setBrandUrl] = useState("");
  const [voice, setVoice] = useState<BrandVoiceProfile>(EMPTY_VOICE);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSourceUrl, setVoiceSourceUrl] = useState<string | null>(null);
  const [brandTargetAudience, setBrandTargetAudience] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [marketContext, setMarketContext] = useState<MarketContext | null>(null);
  const [marketContextLoading, setMarketContextLoading] = useState(false);
  const [marketContextError, setMarketContextError] = useState<string | null>(null);

  // Step 2: Product upload
  const [products, setProducts] = useState<ProductInput[]>([]);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Step 3: Audience & competitor products research
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [productTargetAudience, setProductTargetAudience] = useState("");
  const [audience, setAudience] = useState<AudienceProfile | null>(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorError, setCompetitorError] = useState<string | null>(null);
  const [competitorProducts, setCompetitorProducts] = useState<CompetitorProduct[]>([]);

  // Step 4: Generation
  const [copy, setCopy] = useState<GeneratedCopy | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Export
  const [exportLoading, setExportLoading] = useState<"xlsx" | "docx" | null>(
    null
  );

  const selectedProduct = products.find((p) => p.sku === selectedSku) ?? null;

  async function handleAnalyzeBrand() {
    if (!brandUrl.trim()) return;
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      const res = await fetch("/api/brand-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: brandUrl }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze brand voice");
      }
      setVoice((prev) => ({
        ...data.profile,
        styleAdjustment: prev.styleAdjustment,
        _sliderTechCasual: prev._sliderTechCasual,
        _sliderRestrainedBold: prev._sliderRestrainedBold,
      }));
      setVoiceSourceUrl(data.sourceUrl);
      setBrandTargetAudience(data.brandTargetAudience ?? "");
      setProductCategory(data.productCategory ?? "");
      // Reset market context, it's tied to the previous analysis
      setMarketContext(null);
      setMarketContextError(null);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setVoiceLoading(false);
    }
  }

  async function handleAnalyzeMarket() {
    if (!productCategory) return;
    setMarketContextLoading(true);
    setMarketContextError(null);
    try {
      const res = await fetch("/api/market-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCategory, profile: voice }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Market analysis failed");
      }
      setMarketContext(data.marketContext ?? null);
    } catch (err) {
      setMarketContextError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setMarketContextLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    setUploadError(null);
    setCopy(null);
    resetCompetitorState();
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseProductExcel(buf);
      if (parsed.length === 0) {
        setUploadError(
          "No products found. Make sure the file has columns: SKU, Product Description, Features, Benefits."
        );
        return;
      }
      setProducts(parsed);
      setSelectedSku(parsed[0].sku);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to read file"
      );
    }
  }

  function resetCompetitorState() {
    setProductTargetAudience("");
    setAudience(null);
    setAudienceError(null);
    setCompetitorProducts([]);
    setCompetitorError(null);
  }

  function handleSelectProduct(sku: string) {
    setSelectedSku(sku);
    setCopy(null);
    resetCompetitorState();
  }

  async function handleResearchAudience() {
    if (!selectedProduct) return;
    setAudienceLoading(true);
    setAudienceError(null);
    setAudience(null);
    // Clear competitor products too, since they may depend on the audience
    setCompetitorProducts([]);
    setCompetitorError(null);
    try {
      const res = await fetch("/api/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: selectedProduct,
          voice,
          brandTargetAudience,
          productCategory,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Audience research failed");
      }
      setProductTargetAudience(data.productTargetAudience ?? "");
      setAudience(data.audience ?? null);
    } catch (err) {
      setAudienceError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAudienceLoading(false);
    }
  }

  async function handleFindCompetitorProducts() {
    if (!selectedProduct) return;
    setCompetitorLoading(true);
    setCompetitorError(null);
    setCompetitorProducts([]);
    try {
      const res = await fetch("/api/competitor-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: selectedProduct,
          productCategory,
          productTargetAudience,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Competitor research failed");
      }
      setCompetitorProducts(data.competitors ?? []);
    } catch (err) {
      setCompetitorError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCompetitorLoading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedProduct) return;
    setGenLoading(true);
    setGenError(null);
    setCopy(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: selectedProduct,
          voice,
          brandTargetAudience,
          productTargetAudience,
          marketContextFull: marketContext?.fullContext ?? "",
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }
      setCopy(data.result as GeneratedCopy);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setGenLoading(false);
    }
  }

  async function handleExport(format: "xlsx" | "docx") {
    if (!selectedProduct || !copy) return;
    setExportLoading(format);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: selectedProduct, copy, format }),
      });
      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedProduct.sku}_copy.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportLoading(null);
    }
  }

  const voiceReady = Object.entries(voice).some(
    ([k, v]) => !k.startsWith("_") && typeof v === "string" && v.trim() !== ""
  );
  const step1Status: StepStatus = voiceReady ? "done" : "active";
  const step2Status: StepStatus =
    products.length > 0 ? "done" : voiceReady ? "active" : "pending";
  const step3Status: StepStatus = productTargetAudience
    ? "done"
    : selectedProduct
    ? "active"
    : "pending";
  const step4Status: StepStatus = copy
    ? "done"
    : selectedProduct
    ? "active"
    : "pending";

  return (
    <div className="min-h-screen pb-24" style={{ background: "#e9e9ec" }}>
      <header className="max-w-4xl mx-auto px-6 pt-8 pb-2">
        <div className="flex items-center gap-3 mb-3">
          <HyperBadge />
          <div>
            <h1 className="text-lg font-medium tracking-tight leading-tight">Product Copywriter</h1>
            <p className="text-xs text-[var(--color-muted)]">for Hyper</p>
          </div>
        </div>
        <p className="text-sm text-[var(--color-muted)]">
          Generate on-brand product copy, feature highlights, audience
          profiles, and content ideas from your product data.
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {/* STEP 1: Brand Voice */}
        <section className="step-card p-6">
          <StepHeader number={1} title="Brand voice" status={step1Status} />
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Enter your store&apos;s URL to analyze your brand voice, then
            review and adjust the profile below before generating copy.
          </p>
          <div className="flex gap-2 mb-4">
            <input
              type="url"
              placeholder="https://yourstore.com"
              className="flex-1 border border-[var(--color-line)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3C3FBC]"
              value={brandUrl}
              onChange={(e) => setBrandUrl(e.target.value)}
            />
            <button
              onClick={handleAnalyzeBrand}
              disabled={voiceLoading || !brandUrl.trim()}
              className="px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition"
              style={{ background: "#3C3FBC" }}
            >
              {voiceLoading ? "Analyzing..." : "Analyze site"}
            </button>
          </div>
          {voiceError && (
            <p className="text-sm text-red-600 mb-4">{voiceError}</p>
          )}
          {voiceSourceUrl && (
            <p className="text-xs text-[var(--color-muted)] mb-4">
              Analyzed: {voiceSourceUrl}
            </p>
          )}
          {brandTargetAudience && (
            <div className="mb-4 p-3 rounded bg-[var(--color-paper)] border border-[var(--color-line)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-1">
                Brand target audience
              </p>
              <p className="text-sm">{brandTargetAudience}</p>
            </div>
          )}
          {voiceSourceUrl && !marketContext && (
            <div className="mb-4">
              <button
                onClick={handleAnalyzeMarket}
                disabled={marketContextLoading || !productCategory}
                className="px-4 py-2 rounded text-sm font-medium border border-[var(--color-line)] bg-white hover:bg-[var(--color-paper)] transition disabled:opacity-50"
              >
                {marketContextLoading ? "Analyzing market..." : "Analyze market positioning"}
              </button>
              <p className="text-xs text-[var(--color-muted)] mt-2">
                Optional: research how other brands in your category write,
                and get sliders to adjust your voice relative to the market.
                Runs a few web searches.
              </p>
              {marketContextError && (
                <p className="text-sm text-red-600 mt-2">{marketContextError}</p>
              )}
            </div>
          )}
          <BrandVoiceEditor profile={voice} onChange={setVoice} marketContext={marketContext} />
        </section>

        {/* STEP 2: Product Upload */}
        <section className="step-card p-6">
          <StepHeader number={2} title="Product data" status={step2Status} />
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Upload an Excel file with columns: <code>SKU</code>,{" "}
            <code>Product Description</code>, <code>Features</code>,{" "}
            <code>Benefits</code> (one row per feature).
          </p>
          <label className="block border border-dashed border-[var(--color-line)] rounded-md px-4 py-6 text-center cursor-pointer hover:border-[#3C3FBC] transition mb-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            <SpreadsheetIcon />
            <p className="text-sm text-[var(--color-muted)] mt-2">
              Click to upload an Excel file
            </p>
          </label>
          {uploadError && (
            <p className="text-sm text-red-600 mt-3">{uploadError}</p>
          )}
          {products.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Select product
              </label>
              <select
                className="w-full border border-[var(--color-line)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#3C3FBC]"
                value={selectedSku ?? ""}
                onChange={(e) => handleSelectProduct(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} — {p.productName} ({p.features.length} features)
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* STEP 3: Audience & competitor products */}
        <section className="step-card p-6">
          <StepHeader number={3} title="Audience & competitor products" status={step3Status} />
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Identify who buys this specific product, then optionally find real
            competitor products targeting a similar audience.
          </p>
          <button
            onClick={handleResearchAudience}
            disabled={!selectedProduct || audienceLoading}
            className="px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition"
            style={{ background: "#3C3FBC" }}
          >
            {audienceLoading ? "Researching..." : "Research audience"}
          </button>
          {!selectedProduct && (
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Upload and select a product first.
            </p>
          )}
          {audienceError && (
            <p className="text-sm text-red-600 mt-3">{audienceError}</p>
          )}

          {audience && (
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2">
                  Demographics
                </p>
                <ul className="space-y-1.5">
                  {audience.demographics.map((d, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-[var(--color-muted)] mt-0.5">•</span>
                      <span>
                        {d.point}
                        {d.sourceUrl && (
                          <>
                            {" "}
                            <a
                              href={d.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline"
                              style={{ color: "#3C3FBC" }}
                            >
                              source
                            </a>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2">
                    Psychographics
                  </p>
                  <ul className="space-y-1.5">
                    {audience.psychographics.map((p, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-[var(--color-muted)] mt-0.5">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2">
                    Jobs to be done
                  </p>
                  <ul className="space-y-1.5">
                    {audience.jobsToBeDone.map((j, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-[var(--color-muted)] mt-0.5">•</span>
                        <span>{j}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {audience.persona && (
                <div className="p-3 rounded bg-[var(--color-paper)] border border-[var(--color-line)]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-1">
                    Persona
                  </p>
                  <p className="text-sm leading-relaxed">{audience.persona}</p>
                </div>
              )}

              <div>
                <button
                  onClick={handleFindCompetitorProducts}
                  disabled={competitorLoading}
                  className="px-4 py-2 rounded text-sm font-medium border border-[var(--color-line)] bg-white hover:bg-[var(--color-paper)] transition disabled:opacity-50"
                >
                  {competitorLoading ? "Searching..." : "Find competitor products"}
                </button>
                {competitorError && (
                  <p className="text-sm text-red-600 mt-2">{competitorError}</p>
                )}
              </div>
            </div>
          )}

          {competitorProducts.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-3">Competitor products</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {competitorProducts.map((c, i) => (
                  <div key={i} className="border border-[var(--color-line)] rounded-md p-3 bg-white flex flex-col">
                    <p className="text-sm font-semibold leading-tight mb-1">{c.name}</p>
                    {c.productName && (
                      <p className="text-xs text-[var(--color-muted)] mb-2">{c.productName}</p>
                    )}
                    {c.summary && (
                      <p className="text-xs mb-2 leading-relaxed">{c.summary}</p>
                    )}
                    {c.keyFeatures.length > 0 && (
                      <ul className="text-xs text-[var(--color-muted)] list-disc list-inside space-y-0.5 mb-2">
                        {c.keyFeatures.map((f, j) => (
                          <li key={j}>{f}</li>
                        ))}
                      </ul>
                    )}
                    <a
                      href={c.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline mt-auto"
                      style={{ color: "#3C3FBC" }}
                    >
                      View product page
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* STEP 4: Generate */}
        <section className="step-card p-6">
          <StepHeader number={4} title="Generate copy" status={step4Status} />
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Generate a short product description, per-feature copy, a premium
            image headline, and content ideas in your brand voice.
          </p>
          <button
            onClick={handleGenerate}
            disabled={!selectedProduct || genLoading || !voiceReady}
            className="px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition"
            style={{ background: "#3C3FBC" }}
          >
            {genLoading ? "Generating..." : "Generate copy"}
          </button>
          {!voiceReady && (
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Complete the brand voice profile first.
            </p>
          )}
          {!selectedProduct && voiceReady && (
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Upload product data first.
            </p>
          )}
          {genError && (
            <p className="text-sm text-red-600 mt-3">{genError}</p>
          )}
        </section>

        {/* STEP 5: Review & Export */}
        {copy && (
          <section className="step-card p-6">
            <StepHeader number={5} title="Review & export" status="active" />
            <p className="text-sm text-[var(--color-muted)] mb-4">
              Edit anything below, then export to Excel or Word.
            </p>
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => handleExport("xlsx")}
                disabled={exportLoading !== null}
                className="px-4 py-2 rounded text-sm font-medium border border-[var(--color-line)] bg-white hover:bg-[var(--color-paper)] transition disabled:opacity-50"
              >
                {exportLoading === "xlsx"
                  ? "Exporting..."
                  : "Export to Excel"}
              </button>
              <button
                onClick={() => handleExport("docx")}
                disabled={exportLoading !== null}
                className="px-4 py-2 rounded text-sm font-medium border border-[var(--color-line)] bg-white hover:bg-[var(--color-paper)] transition disabled:opacity-50"
              >
                {exportLoading === "docx"
                  ? "Exporting..."
                  : "Export to Word"}
              </button>
            </div>
            <ResultsEditor copy={copy} onChange={setCopy} />
          </section>
        )}
      </main>
    </div>
  );
}

function StepHeader({
  number,
  title,
  status,
}: {
  number: number;
  title: string;
  status: StepStatus;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold text-white ${
          status === "pending" ? "opacity-40" : ""
        }`}
        style={{ background: "#1a1a1a" }}
      >
        {status === "done" ? "✓" : number}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}

function HyperBadge() {
  return (
    <div
      className="flex items-center justify-center px-2.5 py-1.5 rounded-md"
      style={{ background: "#1a1a1a" }}
    >
      <span className="text-white font-bold text-sm tracking-wide" style={{ letterSpacing: "0.05em" }}>
        HYPER
      </span>
    </div>
  );
}

function SpreadsheetIcon() {
  return (
    <svg className="mx-auto" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-muted)" }}>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
      <path d="M8 9h1" />
    </svg>
  );
}
