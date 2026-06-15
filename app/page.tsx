"use client";

import { useState } from "react";
import { BrandVoiceProfile, GeneratedCopy, ProductInput } from "@/lib/types";
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
  competitorBlend: "",
};

interface CompetitorOption {
  name: string;
  productName: string;
  productUrl: string;
  mainPoints: string[];
  voiceDescription: string;
  blendInstruction: string;
}

type StepStatus = "pending" | "active" | "done";

export default function Home() {
  // Step 1: Brand voice
  const [brandUrl, setBrandUrl] = useState("");
  const [voice, setVoice] = useState<BrandVoiceProfile>(EMPTY_VOICE);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSourceUrl, setVoiceSourceUrl] = useState<string | null>(null);
  const [brandTargetAudience, setBrandTargetAudience] = useState("");
  const [productCategory, setProductCategory] = useState("");

  // Step 2: Product upload
  const [products, setProducts] = useState<ProductInput[]>([]);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Step 3: Competitor research (per product)
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorError, setCompetitorError] = useState<string | null>(null);
  const [productTargetAudience, setProductTargetAudience] = useState("");
  const [competitorOptions, setCompetitorOptions] = useState<CompetitorOption[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);

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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze brand voice");
      }
      setVoice((prev) => ({ ...data.profile, competitorBlend: prev.competitorBlend }));
      setVoiceSourceUrl(data.sourceUrl);
      setBrandTargetAudience(data.brandTargetAudience ?? "");
      setProductCategory(data.productCategory ?? "");
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setVoiceLoading(false);
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
    setCompetitorOptions([]);
    setSelectedCompetitor(null);
    setCompetitorError(null);
  }

  function handleSelectProduct(sku: string) {
    setSelectedSku(sku);
    setCopy(null);
    resetCompetitorState();
  }

  async function handleFindCompetitors() {
    if (!selectedProduct) return;
    setCompetitorLoading(true);
    setCompetitorError(null);
    setCompetitorOptions([]);
    setSelectedCompetitor(null);
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: selectedProduct,
          voice,
          brandTargetAudience,
          productCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Competitor research failed");
      }
      setProductTargetAudience(data.productTargetAudience ?? "");
      setCompetitorOptions(data.competitors ?? []);
    } catch (err) {
      setCompetitorError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCompetitorLoading(false);
    }
  }

  function handleSelectCompetitor(option: CompetitorOption) {
    if (selectedCompetitor === option.name) {
      setSelectedCompetitor(null);
      setVoice((prev) => ({ ...prev, competitorBlend: "" }));
    } else {
      setSelectedCompetitor(option.name);
      setVoice((prev) => ({ ...prev, competitorBlend: option.blendInstruction }));
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
        }),
      });
      const data = await res.json();
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
        const data = await res.json();
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

  const voiceReady = Object.values(voice).some((v) => v.trim() !== "");
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
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-7 h-7 rounded-md bg-[#1a1a1a] flex items-center justify-center">
            <BoltIcon />
          </div>
          <h1 className="text-lg font-medium tracking-tight">Product Copywriter</h1>
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
          <BrandVoiceEditor profile={voice} onChange={setVoice} />
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

        {/* STEP 3: Competitor research */}
        <section className="step-card p-6">
          <StepHeader number={3} title="Audience & competitors" status={step3Status} />
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Identify who buys this specific product and find real competitor
            products targeting a similar audience. Optionally blend in a
            competitor&apos;s style.
          </p>
          <button
            onClick={handleFindCompetitors}
            disabled={!selectedProduct || competitorLoading}
            className="px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50 hover:opacity-90 transition"
            style={{ background: "#3C3FBC" }}
          >
            {competitorLoading ? "Researching..." : "Find audience & competitors"}
          </button>
          {!selectedProduct && (
            <p className="text-xs text-[var(--color-muted)] mt-2">
              Upload and select a product first.
            </p>
          )}
          {competitorError && (
            <p className="text-sm text-red-600 mt-3">{competitorError}</p>
          )}

          {productTargetAudience && (
            <div className="mt-4 mb-4 p-3 rounded bg-[var(--color-paper)] border border-[var(--color-line)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-1">
                Product target audience
              </p>
              <p className="text-sm">{productTargetAudience}</p>
            </div>
          )}

          {competitorOptions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-1">
                Optional: blend in a competitor-inspired style
              </p>
              <p className="text-xs text-[var(--color-muted)] mb-3">
                Click a card to apply that style to your brand voice. Click
                again to remove it.
              </p>
              <div className="space-y-3">
                {competitorOptions.map((option) => {
                  const isSelected = selectedCompetitor === option.name;
                  return (
                    <button
                      key={option.name}
                      type="button"
                      onClick={() => handleSelectCompetitor(option)}
                      className={`w-full text-left p-3 rounded-md border transition ${
                        isSelected
                          ? "ring-1"
                          : "border-[var(--color-line)] bg-white hover:border-[#3C3FBC]/50"
                      }`}
                      style={
                        isSelected
                          ? {
                              borderColor: "#3C3FBC",
                              borderWidth: 2,
                              background: "rgba(60,63,188,0.05)",
                              ["--tw-ring-color" as string]: "#3C3FBC",
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold">
                          {option.name}
                          {option.productName ? ` — ${option.productName}` : ""}
                        </p>
                        {isSelected && (
                          <span className="text-xs font-medium" style={{ color: "#3C3FBC" }}>
                            Selected
                          </span>
                        )}
                      </div>
                      {option.voiceDescription && (
                        <p className="text-xs text-[var(--color-muted)] mb-2">
                          {option.voiceDescription}
                        </p>
                      )}
                      {option.mainPoints?.length > 0 && (
                        <ul className="text-xs text-[var(--color-muted)] list-disc list-inside mb-2 space-y-0.5">
                          {option.mainPoints.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      )}
                      {option.productUrl && (
                        <a
                          href={option.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs underline"
                          style={{ color: "#3C3FBC" }}
                        >
                          View product page
                        </a>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* STEP 4: Generate */}
        <section className="step-card p-6">
          <StepHeader number={4} title="Generate copy" status={step4Status} />
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Generate a long description, per-feature copy, a premium image
            headline, and content ideas in your brand voice.
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

function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
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
