export interface BrandVoiceProfile {
  toneDescriptors: string;
  vocabulary: string;
  sentenceStyle: string;
  recurringThemes: string;
  titleStyle: string;
  notes: string;
  // Style adjustment instruction derived from the positioning sliders,
  // blended into the brand voice during generation.
  styleAdjustment: string;
  // Internal: current slider positions (0-4). Optional, defaults to the
  // market context's detected position for this brand.
  _sliderTechCasual?: number;
  _sliderRestrainedBold?: number;
}

export interface MarketContext {
  toneVsMarket: string;
  vocabularyVsMarket: string;
  titleStyleVsMarket: string;
  notesVsMarket: string;
  fullContext: string;
  technicalCasualMarkers: string[];
  technicalCasualPosition: number;
  restrainedBoldMarkers: string[];
  restrainedBoldPosition: number;
}

export interface ProductFeature {
  feature: string;
  benefit: string;
}

export interface ProductInput {
  sku: string;
  productName: string;
  features: ProductFeature[];
}

export interface FeatureCopy {
  feature: string;
  title: string;
  description: string;
}

export interface AudienceProfile {
  demographics: { point: string; sourceUrl?: string }[];
  psychographics: string[];
  jobsToBeDone: string[];
  persona: string;
}

export interface CompetitorProduct {
  name: string;
  productName: string;
  productUrl: string;
  imageUrl?: string;
  price?: string;
  summary: string;
  keyFeatures: string[];
}

export interface GeneratedCopy {
  longDescription: string;
  featureCopy: FeatureCopy[];
  premiumHeadline: string;
  brandTargetAudience: string;
  productTargetAudience: string;
  blogIdeas: string[];
  educationalArticles: string[];
}
