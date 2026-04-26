// 공통 도메인 타입
import { z } from "zod";

// AI 시스템 사용 분류 (회사가 어떤 AI를 쓰는지)
export const AIUsageSchema = z.enum([
  "chatbot",          // 챗봇/대화형
  "recommendation",   // 추천 엔진
  "generative_text",  // 텍스트 생성형
  "generative_image", // 이미지/영상 생성형
  "auto_decision",    // 자동심사/자동결정 (채용/대출/심사)
  "biometric",        // 생체인식
  "medical",          // 의료 진단/판독
  "none",             // 사용 안 함
]);
export type AIUsage = z.infer<typeof AIUsageSchema>;

// 회사 프로필 입력
export const CompanyProfileSchema = z.object({
  name: z.string().min(1, "회사명 필수"),
  industry: z.string().min(1, "업종 필수"),
  employeeCount: z.coerce.number().int().min(1),
  annualRevenueKRW: z.coerce.number().int().min(0).describe("연매출 (원)"),
  aiUsages: z.array(AIUsageSchema).min(1, "AI 사용 항목 최소 1개"),
  usesForeignAI: z.boolean().default(false).describe("해외 빅테크 AI 연동 여부"),
  notes: z.string().optional(),
});
export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

// 위험 등급
export const RiskLevel = z.enum(["high", "medium", "low", "none"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

// AI 응답이 인용한 조문 텍스트 — 검증 후 verifiedLocator가 채워짐
export const CitationSchema = z.object({
  text: z.string().describe("AI 기본법 조문에서 발췌한 인용 (corpus 내 부분 문자열)"),
  verifiedLocator: z
    .string()
    .nullish()
    .default(null)
    .describe("검증 후 매칭된 조문 위치. null이면 검증 실패"),
});
export type Citation = z.infer<typeof CitationSchema>;

// Gemini가 반환할 진단 결과 스키마
export const DiagnosisItemSchema = z.object({
  obligationId: z.string().describe("적용 조항 식별자 (예: AIBA-NOTICE)"),
  title: z.string().describe("의무 제목"),
  legalBasis: z.string().describe("근거 조항 (예: AI기본법 제31조)"),
  applicability: z.enum(["applicable", "conditional", "not_applicable"]),
  riskLevel: RiskLevel,
  reasoning: z.string().describe("이 회사에 적용되는 이유 (한국어, 2~3문장)"),
  actionItems: z.array(z.string()).describe("이행해야 할 구체 조치 목록"),
  deadline: z.string().describe("이행 마감 (예: '2026-01-22 시행 전')"),
  evidenceTypes: z.array(z.string()).describe("감사 시 제출할 증거 유형"),
  citations: z
    .array(CitationSchema)
    .default([])
    .describe("이 항목 판단을 뒷받침하는 조문 인용 (corpus 발췌)"),
  verified: z
    .boolean()
    .default(false)
    .describe("서버 검증 통과 여부 (인용이 corpus에 실재 + 본문 조문 참조 일치)"),
  unsupportedRefs: z
    .array(z.string())
    .default([])
    .describe("본문에 적혔지만 의무 corpus에 없는 환각 조문 번호 목록"),
});
export type DiagnosisItem = z.infer<typeof DiagnosisItemSchema>;

export const DiagnosisResultSchema = z.object({
  overallRisk: RiskLevel,
  summary: z.string().describe("3~4문장 요약 — 이 회사가 직면한 핵심 리스크"),
  items: z.array(DiagnosisItemSchema),
  recommendedNextSteps: z.array(z.string()).describe("최우선 조치 3개"),
});
export type DiagnosisResult = z.infer<typeof DiagnosisResultSchema>;
