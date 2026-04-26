/**
 * Finding — 인프라(static analyzer)가 emit하는 단일 신호.
 * Synthesizer가 catalogEntryId/ruleId로 룩업해 AISystem 합성.
 */
import { z } from "zod";
import { ConfidenceSchema } from "../catalog/schema";

export const FindingKindSchema = z.enum([
  "manifest_dep", // 의존성 매니페스트
  "import", // 코드 import 패턴
  "env_var", // 환경변수 참조
  "call", // 호출 패턴 (모델명 캡처 가능)
  "api_host", // 네트워크 호출 URL
  "config_key", // 설정 파일 키
  "code_pattern", // CodePatternRule 매칭
]);
export type FindingKind = z.infer<typeof FindingKindSchema>;

export const FindingSchema = z.object({
  kind: FindingKindSchema,
  catalogEntryId: z.string().optional(), // py.openai 등
  ruleId: z.string().optional(), // pattern.image_generation_call 등

  filePath: z.string(),
  lineStart: z.number().int().min(1),
  lineEnd: z.number().int().min(1).optional(),
  snippet: z.string().max(500).optional(),

  extracted: z
    .object({
      modelName: z.string().optional(),
      extras: z.record(z.string(), z.string()).optional(),
    })
    .optional(),

  confidence: ConfidenceSchema,
  testOnly: z.boolean().default(false), // tests/fixtures 디렉토리 매칭
  detectedAt: z.string().datetime().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const ScanReportSchema = z.object({
  repoUrl: z.string(),
  commitSha: z.string().optional(),
  scannedAt: z.string().datetime(),
  ecosystem: z.array(z.enum(["python", "typescript", "javascript"])),
  findings: z.array(FindingSchema),
  fileTree: z.object({
    totalFiles: z.number().int(),
    languageStats: z.record(z.string(), z.number()),
  }),
  context: z.unknown().optional(), // ContextSummary (Gemini 추출)
});
export type ScanReport = z.infer<typeof ScanReportSchema>;
