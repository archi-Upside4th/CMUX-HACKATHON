/**
 * Layer A Rule Engine — ServiceProfileIntake → 의무 발동 판정.
 *
 * 결정적 (LLM 0회). 각 의무는 1개 trigger 함수와 1개 사람-읽을-수-있는 사유 문자열을 반환.
 * 코드 스캔 결과(Layer B)는 별도로 합쳐짐 — 여기서는 profile만 본다.
 *
 * 판정 카테고리:
 *   REQUIRED        — profile만으로 의무 발동 확정
 *   CONDITIONAL     — profile 조건부 발동 (코드 신호 보강 시 확정)
 *   NOT_APPLICABLE  — profile상 발동 사유 없음
 */
import type { ObligationId } from "../catalog/schema";
import type { ServiceProfileIntake } from "./schema";

export type ObligationStatusFromProfile =
  | "REQUIRED"
  | "CONDITIONAL"
  | "NOT_APPLICABLE";

export interface ProfileObligationDecision {
  obligationId: ObligationId;
  status: ObligationStatusFromProfile;
  reason: string;
}

// ──────────────────────────────────────────────────────────
// 임계치 — AI기본법 시행령 초안 기준 (확정 시 갱신 필요)
// ──────────────────────────────────────────────────────────

/** 국내대리인 지정 의무 발동 임계치 (시행령 (안) 기준 추정) */
const FOREIGN_REP_REVENUE_THRESHOLD_KRW = 1_000_000_000_000; // 1조원
const FOREIGN_REP_MAU_THRESHOLD = 1_000_000;                 // 100만명

/** 소규모 사업자 면제 임계치 — 의무 일부 완화 (vexempt — 추정) */
const SMALL_BUSINESS_REVENUE_THRESHOLD_KRW = 12_000_000_000; // 120억원
const SMALL_BUSINESS_MAU_THRESHOLD = 100_000;                // 10만명

function isSmallBusiness(p: ServiceProfileIntake): boolean {
  return (
    p.scale.annualRevenueKRW < SMALL_BUSINESS_REVENUE_THRESHOLD_KRW &&
    p.scale.monthlyActiveUsers < SMALL_BUSINESS_MAU_THRESHOLD
  );
}

function reachesKoreanUsers(p: ServiceProfileIntake): boolean {
  return p.userResidency === "KR_ONLY" || p.userResidency === "MIXED";
}

function isCustomerFacing(p: ServiceProfileIntake): boolean {
  // INTERNAL 도구는 일반 이용자 대상 의무 대부분 면제 가능
  return p.serviceType !== "INTERNAL";
}

// ──────────────────────────────────────────────────────────
// 의무별 판정 함수
// ──────────────────────────────────────────────────────────

function decideNotice(p: ServiceProfileIntake): ProfileObligationDecision {
  // AIBA-NOTICE: AI 사용 사실 사전 고지 의무
  // - 일반 이용자 대상이면 발동
  // - INTERNAL 도구는 면제 가능
  if (!isCustomerFacing(p)) {
    return {
      obligationId: "AIBA-NOTICE",
      status: "NOT_APPLICABLE",
      reason: "내부 도구 — 일반 이용자 대상 아님",
    };
  }
  return {
    obligationId: "AIBA-NOTICE",
    status: "REQUIRED",
    reason: `${p.serviceType} 서비스 — 이용자에 AI 사용 사실 고지 필수`,
  };
}

function decideForeignRep(p: ServiceProfileIntake): ProfileObligationDecision {
  // AIBA-FOREIGN-REP: 국외사업자 국내대리인 지정
  // - 해외 배포 + 국내 이용자 + 임계치 초과 시 발동
  const overseas =
    p.deploymentRegion === "OVERSEAS" || p.deploymentRegion === "MULTI";
  if (!overseas) {
    return {
      obligationId: "AIBA-FOREIGN-REP",
      status: "NOT_APPLICABLE",
      reason: "국내 배포 — 국외사업자 아님",
    };
  }
  if (!reachesKoreanUsers(p)) {
    return {
      obligationId: "AIBA-FOREIGN-REP",
      status: "NOT_APPLICABLE",
      reason: "국내 이용자 없음",
    };
  }
  const overThreshold =
    p.scale.annualRevenueKRW >= FOREIGN_REP_REVENUE_THRESHOLD_KRW ||
    p.scale.monthlyActiveUsers >= FOREIGN_REP_MAU_THRESHOLD;
  if (overThreshold) {
    return {
      obligationId: "AIBA-FOREIGN-REP",
      status: "REQUIRED",
      reason: `해외 배포 + 국내 이용자 + 규모 임계치 초과 (매출 ${p.scale.annualRevenueKRW.toLocaleString()}원, MAU ${p.scale.monthlyActiveUsers.toLocaleString()})`,
    };
  }
  return {
    obligationId: "AIBA-FOREIGN-REP",
    status: "CONDITIONAL",
    reason: "해외 배포 + 국내 이용자 — 규모 성장 시 발동 예정",
  };
}

function decideHighImpact(p: ServiceProfileIntake): ProfileObligationDecision {
  // AIBA-HIGH-IMPACT: 고영향 AI 의무 일체
  // - 고영향 분야 체크 OR 완전자동결정 시 발동
  if (p.highImpactDomains.length > 0) {
    return {
      obligationId: "AIBA-HIGH-IMPACT",
      status: "REQUIRED",
      reason: `고영향 분야 (${p.highImpactDomains.join(", ")})`,
    };
  }
  if (p.automationLevel === "AUTOMATED") {
    return {
      obligationId: "AIBA-HIGH-IMPACT",
      status: "REQUIRED",
      reason: "완전 자동 결정 — 인적 검토 없는 결정은 고영향 추정",
    };
  }
  return {
    obligationId: "AIBA-HIGH-IMPACT",
    status: "NOT_APPLICABLE",
    reason: "고영향 분야 미해당, 자동 결정 아님",
  };
}

function decideImpactAssessment(
  p: ServiceProfileIntake
): ProfileObligationDecision {
  // AIBA-IMPACT-ASSESSMENT: 영향평가 의무
  // - 고영향 AI 발동 시 + 미수행 상태면 REQUIRED
  const hi = decideHighImpact(p);
  if (hi.status !== "REQUIRED") {
    return {
      obligationId: "AIBA-IMPACT-ASSESSMENT",
      status: "NOT_APPLICABLE",
      reason: "고영향 AI 미해당",
    };
  }
  if (p.assessments.impactDone) {
    return {
      obligationId: "AIBA-IMPACT-ASSESSMENT",
      status: "CONDITIONAL",
      reason: "영향평가 수행 보고됨 — 정기 갱신 필요",
    };
  }
  return {
    obligationId: "AIBA-IMPACT-ASSESSMENT",
    status: "REQUIRED",
    reason: "고영향 AI 운영 + 영향평가 미수행",
  };
}

function decideDataGovernance(
  p: ServiceProfileIntake
): ProfileObligationDecision {
  // AIBA-DATA-GOVERNANCE: 학습/추론 데이터 거버넌스
  // - 개인정보 처리 OR 민감정보 처리 시 발동
  if (p.personalData.sensitive) {
    return {
      obligationId: "AIBA-DATA-GOVERNANCE",
      status: "REQUIRED",
      reason: "민감정보 처리 — 강화된 거버넌스 필요",
    };
  }
  if (p.personalData.processes) {
    return {
      obligationId: "AIBA-DATA-GOVERNANCE",
      status: "REQUIRED",
      reason: "개인정보 처리",
    };
  }
  return {
    obligationId: "AIBA-DATA-GOVERNANCE",
    status: "NOT_APPLICABLE",
    reason: "개인정보 처리 없음",
  };
}

function decideRiskMgmt(p: ServiceProfileIntake): ProfileObligationDecision {
  // AIBA-RISK-MGMT: 위험관리체계 — AI 운영자 일반 의무
  // - 소규모 사업자도 기본 발동 (수준만 다름)
  if (p.assessments.riskDone) {
    return {
      obligationId: "AIBA-RISK-MGMT",
      status: "CONDITIONAL",
      reason: "위험평가 수행 보고됨 — 정기 갱신 필요",
    };
  }
  return {
    obligationId: "AIBA-RISK-MGMT",
    status: "REQUIRED",
    reason: isSmallBusiness(p)
      ? "소규모 사업자 — 위험관리체계 간소 운영 가능하나 의무 자체는 발동"
      : "AI 운영자 일반 의무",
  };
}

function decidePublicDisclosure(
  p: ServiceProfileIntake
): ProfileObligationDecision {
  // AIBA-PUBLIC-DISCLOSURE: AI 시스템 공개정보 게시
  // - B2C/B2G에 발동 (이용자/국민에 대한 투명성)
  if (p.serviceType === "B2C" || p.serviceType === "B2G") {
    return {
      obligationId: "AIBA-PUBLIC-DISCLOSURE",
      status: "REQUIRED",
      reason: `${p.serviceType} — 이용자/공공 대상 정보공개 의무`,
    };
  }
  return {
    obligationId: "AIBA-PUBLIC-DISCLOSURE",
    status: "NOT_APPLICABLE",
    reason: `${p.serviceType} — 일반 공개 의무 대상 아님`,
  };
}

/**
 * 코드 신호가 필요한 의무 — profile만으로는 결정 불가, 항상 CONDITIONAL.
 *   AIBA-WATERMARK: 생성형 AI 사용 여부 (코드에서)
 *   AIBA-HIGH-COMPUTE: 학습 컴퓨트 임계치 (코드의 fine-tuning/GPU 신호)
 */
function decideWatermark(_p: ServiceProfileIntake): ProfileObligationDecision {
  return {
    obligationId: "AIBA-WATERMARK",
    status: "CONDITIONAL",
    reason: "생성형 AI 사용 여부는 코드 분석 결과로 확정",
  };
}

function decideHighCompute(
  _p: ServiceProfileIntake
): ProfileObligationDecision {
  return {
    obligationId: "AIBA-HIGH-COMPUTE",
    status: "CONDITIONAL",
    reason: "학습 컴퓨트 임계치 충족 여부는 코드/인프라 분석 결과로 확정",
  };
}

// ──────────────────────────────────────────────────────────
// 메인 엔트리
// ──────────────────────────────────────────────────────────

export interface ProfileRuleResult {
  decisions: ProfileObligationDecision[];
  /** REQUIRED만 추출 — synthesizer 빠른 조회용 */
  requiredObligations: ObligationId[];
  /** CONDITIONAL만 추출 — 코드 신호로 확정 가능 */
  conditionalObligations: ObligationId[];
  /** small business 플래그 — 일부 의무 강도 조정에 사용 */
  smallBusiness: boolean;
}

export function evaluateProfile(
  profile: ServiceProfileIntake
): ProfileRuleResult {
  const decisions: ProfileObligationDecision[] = [
    decideNotice(profile),
    decideForeignRep(profile),
    decideHighImpact(profile),
    decideImpactAssessment(profile),
    decideDataGovernance(profile),
    decideRiskMgmt(profile),
    decidePublicDisclosure(profile),
    decideWatermark(profile),
    decideHighCompute(profile),
  ];
  return {
    decisions,
    requiredObligations: decisions
      .filter((d) => d.status === "REQUIRED")
      .map((d) => d.obligationId),
    conditionalObligations: decisions
      .filter((d) => d.status === "CONDITIONAL")
      .map((d) => d.obligationId),
    smallBusiness: isSmallBusiness(profile),
  };
}
