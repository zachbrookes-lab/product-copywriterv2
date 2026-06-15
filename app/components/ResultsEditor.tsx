"use client";

import { GeneratedCopy } from "@/lib/types";

interface Props {
  copy: GeneratedCopy;
  onChange: (copy: GeneratedCopy) => void;
}

function Field({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <textarea
        className="w-full border border-[var(--color-line)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function ResultsEditor({ copy, onChange }: Props) {
  return (
    <div className="space-y-8">
      <Field
        label="Long Description"
        value={copy.longDescription}
        onChange={(v) => onChange({ ...copy, longDescription: v })}
        rows={10}
      />

      <Field
        label="Premium Image Headline"
        value={copy.premiumHeadline}
        onChange={(v) => onChange({ ...copy, premiumHeadline: v })}
        rows={1}
      />

      <div>
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-[var(--color-muted)]">
          Feature Copy
        </h3>
        <div className="space-y-4">
          {copy.featureCopy.map((f, i) => (
            <div key={i} className="step-card p-3">
              <p className="text-xs text-[var(--color-muted)] mb-2">
                Source feature: {f.feature}
              </p>
              <div className="space-y-2">
                <Field
                  label="Title"
                  value={f.title}
                  rows={1}
                  onChange={(v) => {
                    const next = [...copy.featureCopy];
                    next[i] = { ...next[i], title: v };
                    onChange({ ...copy, featureCopy: next });
                  }}
                />
                <Field
                  label="Description"
                  value={f.description}
                  rows={2}
                  onChange={(v) => {
                    const next = [...copy.featureCopy];
                    next[i] = { ...next[i], description: v };
                    onChange({ ...copy, featureCopy: next });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <Field
        label="Brand Target Audience"
        value={copy.brandTargetAudience}
        onChange={(v) => onChange({ ...copy, brandTargetAudience: v })}
        rows={3}
      />

      <Field
        label="Product Target Audience"
        value={copy.productTargetAudience}
        onChange={(v) => onChange({ ...copy, productTargetAudience: v })}
        rows={3}
      />

      <div>
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-[var(--color-muted)]">
          Blog Content Ideas (5)
        </h3>
        <div className="space-y-2">
          {copy.blogIdeas.map((idea, i) => (
            <input
              key={i}
              className="w-full border border-[var(--color-line)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              value={idea}
              onChange={(e) => {
                const next = [...copy.blogIdeas];
                next[i] = e.target.value;
                onChange({ ...copy, blogIdeas: next });
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-[var(--color-muted)]">
          Educational Article Ideas (5)
        </h3>
        <div className="space-y-2">
          {copy.educationalArticles.map((idea, i) => (
            <input
              key={i}
              className="w-full border border-[var(--color-line)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              value={idea}
              onChange={(e) => {
                const next = [...copy.educationalArticles];
                next[i] = e.target.value;
                onChange({ ...copy, educationalArticles: next });
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
