/**
 * AISystem — 합성된 AI 시스템 단위. 필드별 evidence 추적.
 */
import { z } from "zod";
import {
  ProcurementSchema,
  ModalitySchema,
  DomainSchema,
  AutonomySchema,
  ObligationIdSchema,
  ConfidenceSchema,
} from "../catalog/schema";

export const EvidenceRefSchema = z.object({
  catalogEntryIds: z.array(z.string()).default([]),
  ruleIds: z.array(z.string()).default([]),
  filePaths: z.array(z.string()).default([]),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const FieldEvidenceSchema = z.object({
  confidence: ConfidenceSchema,
  evidence: EvidenceRefSchema,
  needsUserConfirmation: z.boolean().default(false),
});

export const RiskTierSchema = z.enum(["high", "medium", "low"]);
export type RiskTier = z.infer<typeof RiskTierSchema>;

export const AISystemSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  catalogEntryId: z.string(), // 주된 카탈로그 엔트리
  procurement: ProcurementSchema,
  modelProvider: z.string(),
  modelName: z.string().optional(),
  isForeignModel: z.boolean(),
  domains: z.array(DomainSchema),
  modalities: z.array(ModalitySchema),
  isGenerative: z.boolean(),
  autonomy: AutonomySchema.optional(),
  trainsOrFineTunes: z.boolean(),
  derivedRiskTier: RiskTierSchema,
  triggeredObligations: z.array(ObligationIdSchema),
  confidence: ConfidenceSchema,
  evidence: EvidenceRefSchema,
  notes: z.string().optional(),
});
export type AISystem = z.infer<typeof AISystemSchema>;
