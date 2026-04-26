/**
 * ServiceProfileIntake — Layer A 사용자 입력 스키마.
 *
 * AI 기본법 적용 여부와 의무 강도는 코드만으로 결정 불가.
 * 11문항 폼 입력을 결정적 rule engine 입력으로 사용.
 *
 * - 코드 스캔 (Layer B) 결과는 일부 필드(crossBorderTransfer 등)를
 *   자동 보강할 수 있으나, 최종 판정은 이 폼 값 우선.
 * - 모순 검출은 Layer C 머지 단계에서 수행.
 */
import { z } from "zod";

export const ServiceTypeSchema = z.enum([
  "B2B",
  "B2C",
  "B2G",
  "INTERNAL",
]);
export type ServiceType = z.infer<typeof ServiceTypeSchema>;

export const UserResidencySchema = z.enum([
  "KR_ONLY",
  "OVERSEAS_ONLY",
  "MIXED",
]);
export type UserResidency = z.infer<typeof UserResidencySchema>;

export const DeploymentRegionSchema = z.enum([
  "KR",
  "OVERSEAS",
  "MULTI",
]);
export type DeploymentRegion = z.infer<typeof DeploymentRegionSchema>;

export const AutomationLevelSchema = z.enum([
  "INFO_ONLY",       // 정보 제공만
  "RECOMMENDATION",  // 추천 — 사람이 결정
  "AUTOMATED",       // 완전 자동 결정
]);
export type AutomationLevel = z.infer<typeof AutomationLevelSchema>;

/** AI기본법 시행령상 명시된 고영향 영역 후보 + 일반 비즈니스 분류 */
export const HighImpactDomainSchema = z.enum([
  "MEDICAL",      // 의료
  "FINANCE",      // 금융 (신용평가/대출 결정 포함)
  "HIRING",       // 채용/인사
  "JUDICIAL",     // 사법/법집행
  "PUBLIC",       // 공공서비스
  "ESSENTIALS",   // 필수재 (전기/가스/통신)
  "EDUCATION",    // 교육 평가
  "ENERGY",       // 에너지/환경 인프라
]);
export type HighImpactDomain = z.infer<typeof HighImpactDomainSchema>;

export const ServiceStatusSchema = z.enum([
  "EXISTING",   // 시행일(2026-01-22) 이전 운영 중
  "NEW_LAUNCH", // 시행일 이후 신규 출시
]);
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

export const ServiceProfileIntakeSchema = z.object({
  // 1. 서비스 형태
  serviceType: ServiceTypeSchema,

  // 2. 이용자 거주지
  userResidency: UserResidencySchema,

  // 3. 배포 리전
  deploymentRegion: DeploymentRegionSchema,

  // 4. 개인정보
  personalData: z.object({
    processes: z.boolean(),         // 개인정보 수집/처리 여부
    sensitive: z.boolean(),         // 민감정보 포함 여부 (건강/생체/사상 등)
  }),

  // 5. 국외이전 (외국 모델사 호출 = 국외이전 해당 가능)
  // null = 미입력 → Layer B에서 자동 보강
  crossBorderTransfer: z.boolean().nullable(),

  // 6. 결정 자동화 비중
  automationLevel: AutomationLevelSchema,

  // 7. 고영향 분야 (해당 영역 다중 선택)
  highImpactDomains: z.array(HighImpactDomainSchema).default([]),

  // 8. 시행일 기준 서비스 상태
  serviceStatus: ServiceStatusSchema,

  // 9. 사업 규모
  scale: z.object({
    annualRevenueKRW: z.number().int().min(0),  // 원화 연매출
    monthlyActiveUsers: z.number().int().min(0), // MAU
  }),

  // 10. 조직 거버넌스
  organization: z.object({
    hasAIOfficer: z.boolean(),  // AI 책임자 (AI기본법상 신설)
    hasDPO: z.boolean(),        // 개인정보 보호책임자
    hasCISO: z.boolean(),       // 정보보호 최고책임자
  }),

  // 11. 평가 수행 여부
  assessments: z.object({
    impactDone: z.boolean(),  // 영향평가 (고영향 AI 의무)
    riskDone: z.boolean(),    // 위험평가 (전반적 리스크 관리)
  }),
});
export type ServiceProfileIntake = z.infer<typeof ServiceProfileIntakeSchema>;

/**
 * Default profile — 자동 추론 실패 시 안전한 추정치.
 * "최대 의무 발동" 쪽으로 보수적 — false positive가 false negative보다 안전.
 */
export const CONSERVATIVE_DEFAULT_PROFILE: ServiceProfileIntake = {
  serviceType: "B2C",
  userResidency: "MIXED",
  deploymentRegion: "MULTI",
  personalData: { processes: true, sensitive: false },
  crossBorderTransfer: null,
  automationLevel: "RECOMMENDATION",
  highImpactDomains: [],
  serviceStatus: "NEW_LAUNCH",
  scale: { annualRevenueKRW: 0, monthlyActiveUsers: 0 },
  organization: { hasAIOfficer: false, hasDPO: false, hasCISO: false },
  assessments: { impactDone: false, riskDone: false },
};
