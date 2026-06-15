export interface BrandVoiceProfile {
  toneDescriptors: string;
  vocabulary: string;
  sentenceStyle: string;
  recurringThemes: string;
  titleStyle: string;
  notes: string;
  competitorBlend: string;
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

export interface GeneratedCopy {
  longDescription: string;
  featureCopy: FeatureCopy[];
  premiumHeadline: string;
  brandTargetAudience: string;
  productTargetAudience: string;
  blogIdeas: string[];
  educationalArticles: string[];
}
