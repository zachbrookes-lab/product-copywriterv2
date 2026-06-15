"use client";

import { BrandVoiceProfile } from "@/lib/types";

interface Props {
  profile: BrandVoiceProfile;
  onChange: (profile: BrandVoiceProfile) => void;
}

const FIELDS: { key: keyof BrandVoiceProfile; label: string; hint: string }[] = [
  {
    key: "toneDescriptors",
    label: "Tone",
    hint: "e.g. confident, energetic, technical",
  },
  {
    key: "vocabulary",
    label: "Vocabulary",
    hint: "Words/phrases this brand uses often",
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
  },
  {
    key: "notes",
    label: "Additional notes",
    hint: "Anything else about the voice",
  },
];

export default function BrandVoiceEditor({ profile, onChange }: Props) {
  return (
    <div className="space-y-4">
      {FIELDS.map(({ key, label, hint }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-[var(--color-ink)] mb-1">
            {label}
          </label>
          <p className="text-xs text-[var(--color-muted)] mb-1.5">{hint}</p>
          <textarea
            className="w-full border border-[var(--color-line)] rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            rows={key === "vocabulary" || key === "recurringThemes" ? 2 : 3}
            value={profile[key]}
            onChange={(e) => onChange({ ...profile, [key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
