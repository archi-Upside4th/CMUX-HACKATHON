/**
 * Service-level compliance report schemas.
 *
 * 흐름: RepoContext (정적) → ServiceProfile (Gemini 1차) → ComplianceReport (Gemini 2차)
 */
import { z } from "zod";
import { ObligationIdSchema } from "@/lib/scan/catalog/schema";

// ──────────────────────────────────────────────────────────
// RepoContext — 정적 수집 (Gemini 호출 0회)
// ──────────────────────────────────────────────────────────

export const RouteSchema = z.object({
  method: z.string(),
  path: z.string(),
  handlerFile: z.string(),
});
export type Route = z.infer<typeof RouteSchema>;

export const SchemaFileSchema = z.object({
  path: z.string(),
  kind: z.enum([
    "prisma",
    "sequelize",
    "sqlalchemy",
    "django_models",
    "typeorm",
    "drizzle",
    "raw_sql",
    "other",
  ]),
});

export const SystemCallSiteSchema = z.object({
  filePath: z.string(),
  lineStart: z.number().int(),
  snippet: z.string(),
  enclosingHandler: z.string().optional(),
  dataInputHints: z.array(z.string()),
});

export type SystemCallSite = z.infer<typeof SystemCallSiteSchema>;

export const SystemCallContextSchema = z.object({
  systemId: z.string(),
  callSites: z.array(SystemCallSiteSchema),
});
export type SystemCallContext = z.infer<typeof SystemCallContextSchema>;

export const RepoContextSchema = z.object({
  serviceName: z.string().optional(),
  serviceDescription: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  packageManagers: z.array(z.string()).default([]),
  scripts: z.record(z.string(), z.string()).default({}),

  publicRoutes: z.array(RouteSchema).default([]),
  pages: z.array(z.string()).default([]),
  authMechanism: z
    .enum(["none", "session", "jwt", "oauth", "unknown"])
    .default("unknown"),

  schemaFiles: z.array(SchemaFileSchema).default([]),
  envVarsDeclared: z.array(z.string()).default([]),
  storageBackends: z.array(z.string()).default([]),

  readmeExcerpt: z.string().default(""),

  systemCallContexts: z.array(SystemCallContextSchema).default([]),
});
export type RepoContext = z.infer<typeof RepoContextSchema>;

// ──────────────────────────────────────────────────────────
// ServiceProfile — Gemini 1차 산출
// ──────────────────────────────────────────────────────────

export const ServiceProfileSchema = z.object({
  servicePurpose: z.string(),
  userTypes: z.array(
    z.enum(["end_user", "internal_admin", "developer", "anonymous"])
  ),
  primaryDomain: z.enum([
    "credit_finance",
    "employment",
    "healthcare",
    "biometric_id",
    "law_enforcement",
    "education",
    "general",
  ]),
  dataSensitivity: z.enum(["high", "medium", "low"]),
  dataKinds: z.array(
    z.enum(["pii", "financial", "health", "biometric", "behavioral", "none"])
  ),
  decisionAutomation: z.enum([
    "none",
    "advisory",
    "human_in_loop",
    "fully_automated",
  ]),
  customerExposure: z.boolean(),
  reasoning: z.string(),
  evidenceFiles: z.array(z.string()),
});
export type ServiceProfile = z.infer<typeof ServiceProfileSchema>;

// ──────────────────────────────────────────────────────────
// ComplianceReport — Gemini 2차 산출
// ──────────────────────────────────────────────────────────

export const RiskItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.number().int().min(1).max(5),
  likelihood: z.number().int().min(1).max(5),
  impact: z.string(),
  affectedSystemIds: z.array(z.string()),
  affectedObligations: z.array(ObligationIdSchema),
  mitigation: z.string(),
  owner: z.enum(["engineering", "legal", "product", "security", "executive"]),
});
export type RiskItem = z.infer<typeof RiskItemSchema>;

export const SystemAnalysisSchema = z.object({
  systemId: z.string(),
  role: z.string(),
  dataFlow: z.string(),
  crossSystemInteractions: z.array(z.string()),
  riskNarrative: z.string(),
  mitigations: z.array(z.string()),
  auditableArtifacts: z.array(z.string()),
});
export type SystemAnalysis = z.infer<typeof SystemAnalysisSchema>;

export const ReportCitationSchema = z.object({
  text: z.string(),
  verifiedLocator: z.string().nullable(),
});
export type ReportCitation = z.infer<typeof ReportCitationSchema>;

export const ObligationDeepDiveSchema = z.object({
  obligationId: ObligationIdSchema,
  title: z.string(),
  applicability: z.enum(["applicable", "conditional", "not_applicable"]),
  rationale: z.string(),
  triggeringSystems: z.array(z.string()),
  requiredEvidence: z.array(z.string()),
  immediateActions: z.array(z.string()),
  longTermActions: z.array(z.string()),
  blockers: z.array(z.string()),
  citations: z.array(ReportCitationSchema).default([]),
  verified: z.boolean().default(false),
  unsupportedRefs: z.array(z.string()).default([]),
});
export type ObligationDeepDive = z.infer<typeof ObligationDeepDiveSchema>;

export const ActionItemSchema = z.object({
  title: z.string(),
  owner: z.enum([
    "engineering",
    "legal",
    "product",
    "security",
    "executive",
  ]),
  effort: z.enum(["S", "M", "L"]),
  relatedObligations: z.array(ObligationIdSchema),
});
export type ActionItem = z.infer<typeof ActionItemSchema>;

export const ComplianceReportSchema = z.object({
  executiveSummary: z.string(),
  overallRisk: z.enum(["high", "medium", "low"]),
  riskRegister: z.array(RiskItemSchema),
  systemAnalyses: z.array(SystemAnalysisSchema),
  obligationDeepDive: z.array(ObligationDeepDiveSchema),
  roadmap: z.object({
    p1_urgent: z.array(ActionItemSchema),
    p2_important: z.array(ActionItemSchema),
    p3_planned: z.array(ActionItemSchema),
  }),
  openQuestions: z.array(z.string()),
});
export type ComplianceReport = z.infer<typeof ComplianceReportSchema>;
