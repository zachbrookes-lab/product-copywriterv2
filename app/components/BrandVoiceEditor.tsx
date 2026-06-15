"use client";

import { BrandVoiceProfile, MarketContext } from "@/lib/types";

interface Props {
  profile: BrandVoiceProfile;
  onChange: (profile: BrandVoiceProfile) => void;
  marketContext?: MarketContext | null;
}

const FIELDS: { key: keyof BrandVoiceProfile; label: string; hint: string; marketKey?: keyof MarketContext }[] = [
  {
    key: "toneDescriptors",
    label: "Tone",
    hint: "e.g. confident, energetic, technical",
    marketKey: "toneVsMarket",
  },
  {
    key: "vocabulary",
    label: "Vocabulary",
    hint: "Words/phrases this brand uses often",
    marketKey: "vocabularyVsMarket",
  },
  {
    key: "sentenceStyle",
    label: "Sentence style",
    hint: "How sentences and headlines are typically structured",
  },
  {
    key: "recurringThemes",
    label: "Recurring themes",
    hint: "e.g. sustainability, speed, simplicity",
  },
  {
    key: "titleStyle",
    label: "Title style",
    hint: "How product/feature titles are written",
    marketKey: "titleStyleVsMarket",
  },
  {
    key: "notes",
    label: "Additional notes",
    hint: "Anything else about the voice",
    marketKey: "notesVsMarket",
  },
];

function buildStyleAdjustment(
  marketContext: MarketContext,
  techCasual: number,
  restrainedBold: number
): string {
  const techLabel = marketContext.technicalCasualMarkers[techCasual] ?? "";
  const boldLabel = marketContext.restrainedBoldMarkers[restrainedBold] ?? "";

  const parts: string[] = [];

  if (techCasual !== marketContext.technicalCasualPosition) {
    parts.push(
      `Shift the vocabulary and sentence complexity toward "${techLabel}" on a technical-to-casual spectrum (where this brand currently sits closer to "${
        marketContext.technicalCasualMarkers[marketContext.technicalCasualPosition] ?? ""
      }").`
    );
  }

  if (restrainedBold !== marketContext.restrainedBoldPosition) {
    parts.push(
      `Shift the overall energy and confidence of the tone toward "${boldLabel}" on a restrained-to-bold spectrum (where this brand currently sits closer to "${
        marketContext.restrainedBoldMarkers[marketContext.restrainedBoldPosition] ?? ""
      }").`
    );
  }

  return parts.join(" ");
}

export default function BrandVoiceEditor({ profile, onChange, marketContext }: Props) {
  // Slider positions default to the brand's current market position
  const techCasual = profile._sliderTechCasual ?? marketContext?.technicalCasualPosition ?? 2;
  const restrainedBold = profile._sliderRestrainedBold ?? marketContext?.restrainedBoldPosition ?? 2;

  function updateSliders(nextTechCasual: number, nextRestrainedBold: number) {
    const next: BrandVoiceProfile = {
      ...profile,
      _sliderTechCasual: nextTechCasual,
      _sliderRestrainedBold: nextRestrainedBold,
    };
    if (marketContext) {
      next.styleAdjustment = buildStyleAdjustment(marketContext, nextTechCasual, nextRestrainedBold);
    }
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {marketContext && (
        <div className="p-4 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] space-y-5">
          <div>
            <p className="text-sm font-medium mb-2">Voice positioning vs. the market</p>
            <p className="text-xs text-[var(--color-muted)] mb-3">
              Based on how brands in this category typically write. Drag to
              adjust how your generated copy should lean, relative to your
              current voice.
            </p>
          </div>
          <PositionSlider
            label="Technical &harr; Casual"
            markers={marketContext.technicalCasualMarkers}
            currentPosition={marketContext.technicalCasualPosition}
            value={techCasual}
            onChange={(v) => updateSliders(v, restrainedBold)}
          />
          <PositionSlider
            label="Restrained &harr; Bold"
            markers={marketContext.restrainedBoldMarkers}
            currentPosition={marketContext.restrainedBoldPosition}
            value={restrainedBold}
            onChange={(v) => updateSliders(techCasual, v)}
          />
        </div>
      )}

      {FIELDS.map(({ key, label, hint, marketKey }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
            {label}
          </label>
          <p className="text-xs text-[var(--color-muted)] mb-1.5">{hint}</p>
          {marketKey && marketContext && marketContext[marketKey] && (
            <p className="text-xs italic text-[var(--color-accent)] mb-1.5">
              vs. market: {String(marketContext[marketKey])}
            </p>
          )}
          <textarea
            className="w-full border border-[var(--color-line)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            rows={key === "vocabulary" || key === "recurringThemes" ? 2 : 3}
            value={profile[key] as string}
            onChange={(e) => onChange({ ...profile, [key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

function PositionSlider({
  label,
  markers,
  currentPosition,
  value,
  onChange,
}: {
  label: string;
  markers: string[];
  currentPosition: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium">{label}</p>
        {value !== currentPosition && (
          <button
            type="button"
            onClick={() => onChange(currentPosition)}
            className="text-xs underline text-[var(--color-muted)]"
          >
            Reset
          </button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={4}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between mt-1">
        {markers.map((marker, i) => (
          <div key={i} className="text-center" style={{ width: `${100 / markers.length}%` }}>
            <p
              className={`text-[11px] leading-tight ${
                i === value ? "font-semibold text-[var(--color-accent)]" : "text-[var(--color-muted)]"
              }`}
            >
              {marker}
            </p>
            {i === currentPosition && (
              <p className="text-[10px] text-[var(--color-muted)]">(current)</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
