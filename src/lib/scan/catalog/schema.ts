/**
 * 카탈로그 스키마 — 라이브러리/SDK 1개 = 카탈로그 엔트리 1개.
 * YAML 외부화. loader.ts가 빌드 시 Zod 검증.
 */
import { z } from "zod";

// === 공통 enum ===

export const EcosystemSchema = z.enum(["python", "typescript", "any"]);
export type Ecosystem = z.infer<typeof EcosystemSchema>;

export const ProcurementSchema = z.enum([
  "third_party_api", // OpenAI, Anthropic 직접 호출
  "vendor_saas", // AWS Bedrock, Vertex AI
  "open_source", // diffusers, transformers 자체 호스팅
  "self_developed", // 사내 ML
  "korean_llm", // 한국 모델 (HyperCLOVA, Solar 등)
]);
export type Procurement = z.infer<typeof ProcurementSchema>;

export const ModalitySchema = z.enum([
  "text",
  "image",
  "audio",
  "video",
  "embedding",
  "tabular",
  "multimodal",
]);
export type Modality = z.infer<typeof ModalitySchema>;

export const DomainSchema = z.enum([
  "general",
  "credit_finance",
  "employment",
  "healthcare",
  "education",
  "biometric_id",
  "law_enforcement",
  "public_service",
  "advertising_recsys",
  "content_moderation",
  "customer_support",
  "code_assist",
  "marketing_creative",
  "research_internal",
]);
export type Domain = z.infer<typeof DomainSchema>;

export const AutonomySchema = z.enum([
  "human_in_the_loop",
  "human_on_the_loop",
  "fully_automated",
]);
export type Autonomy = z.infer<typeof AutonomySchema>;

export const ObligationIdSchema = z.enum([
  "AIBA-NOTICE",
  "AIBA-WATERMARK",
  "AIBA-HIGH-IMPACT",
  "AIBA-FOREIGN-REP",
  "AIBA-RISK-MGMT",
  "AIBA-DATA-GOVERNANCE",
  "AIBA-HIGH-COMPUTE",
  "AIBA-PUBLIC-DISCLOSURE",
  "AIBA-IMPACT-ASSESSMENT",
]);
export type ObligationId = z.infer<typeof ObligationIdSchema>;

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const CategorySchema = z.enum([
  "llm_api",
  "agent_framework",
  "vision_model",
  "biometric",
  "model_hub",
  "cloud_ml",
  "classical_ml",
  "local_runtime",
  "korean_llm",
]);
export type Category = z.infer<typeof CategorySchema>;

// === 패턴 ===

export const CallPatternSchema = z.object({
  regex: z.string(),
  captureModel: z.boolean().default(false),
  captureGroup: z.number().int().min(1).optional(),
});
export type CallPattern = z.infer<typeof CallPatternSchema>;

export const CatalogPatternsSchema = z.object({
  ecosystem: EcosystemSchema,
  manifestNames: z.array(z.string()).default([]),
  manifestFiles: z.array(z.string()).default([]),
  importPatterns: z.array(z.string()).default([]),
  envVars: z.array(z.string()).default([]),
  callPatterns: z.array(CallPatternSchema).default([]),
  apiHosts: z.array(z.string()).default([]),
});
export type CatalogPatterns = z.infer<typeof CatalogPatternsSchema>;

// === 추론 ===

export const ConditionalObligationSchema = z.object({
  obligationId: ObligationIdSchema,
  requiresPattern: z.string(), // code-patterns.ts의 룰 ID
});
export type ConditionalObligation = z.infer<typeof ConditionalObligationSchema>;

export const CatalogInferencesSchema = z.object({
  procurement: ProcurementSchema,
  modelProvider: z.string(),
  knownModels: z.array(z.string()).default([]),
  isForeignModel: z.boolean().optional(),
  modalities: z.array(ModalitySchema).default([]),
  isGenerative: z.boolean().default(false),
  domainHints: z.array(DomainSchema).default(["general"]),
  autonomyHint: AutonomySchema.optional(),
  trainsOrFineTunes: z.boolean().default(false),
  autoTriggeredObligations: z.array(ObligationIdSchema).default([]),
  conditionalObligations: z.array(ConditionalObligationSchema).default([]),
});
export type CatalogInferences = z.infer<typeof CatalogInferencesSchema>;

// === 엔트리 ===

export const CatalogEntrySchema = z.object({
  id: z.string().regex(/^[a-z]+\.[a-z0-9_-]+$/, "id must be {ecosystem}.{name}"),
  name: z.string(),
  nameKo: z.string(),
  category: CategorySchema,
  patterns: CatalogPatternsSchema,
  inferences: CatalogInferencesSchema,
  confidence: ConfidenceSchema,
  description: z.string().optional(),
  descriptionKo: z.string(),
  references: z.array(z.string().url()).default([]),
  addedAt: z.string(),
});
export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;
