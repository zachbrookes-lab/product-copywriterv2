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

type StepStatus = "pending" | "active" | "done";

export default function Home() {
  // Step 1: Brand voice
  const [brandUrl, setBrandUrl] = useState("");
  const [voice, setVoice] = useState<BrandVoiceProfile>(EMPTY_VOICE);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSourceUrl, setVoiceSourceUrl] = useState<string | null>(null);

  // Step 2: Product upload
  const [products, setProducts] = useState<ProductInput[]>([]);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Step 3: Generation
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
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setVoiceLoading(false);
    }
  }

  async function handleFileUpload(file: File) {
    setUploadError(null);
    setCopy(null);
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

  async function handleGenerate() {
    if (!selectedProduct) return;
    setGenLoading(true);
    setGenError(null);
    setCopy(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: selectedProduct, voice }),
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
  const step3Status: StepStatus = copy
    ? "done"
    : selectedProduct
    ? "active"
    : "pending";

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-[var(--color-line)] bg-white">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Product Copywriter
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Generate on-brand product copy, feature highlights, audience
            profiles, and content ideas from your product data.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
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
              className="flex-1 border border-[var(--color-line)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              value={brandUrl}
              onChange={(e) => setBrandUrl(e.target.value)}
            />
            <button
              onClick={handleAnalyzeBrand}
              disabled={voiceLoading || !brandUrl.trim()}
              className="px-4 py-2 rounded text-sm font-medium bg-[var(--color-accent)] text-white disabled:opacity-50 hover:opacity-90 transition"
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
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            className="text-sm"
          />
          {uploadError && (
            <p className="text-sm text-red-600 mt-3">{uploadError}</p>
          )}
          {products.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">
                Select product
              </label>
              <select
                className="w-full border border-[var(--color-line)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={selectedSku ?? ""}
                onChange={(e) => {
                  setSelectedSku(e.target.value);
                  setCopy(null);
                }}
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

        {/* STEP 3: Generate */}
        <section className="step-card p-6">
          <StepHeader number={3} title="Generate copy" status={step3Status} />
          <p className="text-sm text-[var(--color-muted)] mb-4">
            Generate a long description, per-feature copy, a premium image
            headline, audience profiles, and content ideas in your brand
            voice.
          </p>
          <button
            onClick={handleGenerate}
            disabled={!selectedProduct || genLoading || !voiceReady}
            className="px-4 py-2 rounded text-sm font-medium bg-[var(--color-accent)] text-white disabled:opacity-50 hover:opacity-90 transition"
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

        {/* STEP 4: Review & Export */}
        {copy && (
          <section className="step-card p-6">
            <StepHeader number={4} title="Review & export" status="active" />
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
        className={`flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold ${
          status === "done"
            ? "bg-[var(--color-accent)] text-white"
            : status === "active"
            ? "bg-[var(--color-ink)] text-white"
            : "bg-[var(--color-line)] text-[var(--color-muted)]"
        }`}
      >
        {status === "done" ? "✓" : number}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}
