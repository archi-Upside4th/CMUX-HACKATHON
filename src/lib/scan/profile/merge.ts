/**
 * Layer C — Profile (Layer A) + Code Synthesis (Layer B) 머지.
 *
 * 입력: profile rule 결과 + 코드 합성 결과 (AISystem[])
 * 출력: MergedObligation[] — 의무별 통합 관점
 *       contradictions[] — profile vs code 모순 플래그
 *
 * 규칙:
 *  - profile=REQUIRED ∨ code-detected → status=REQUIRED
 *  - profile=CONDITIONAL ∧ code-detected → status=REQUIRED (코드 신호로 확정)
 *  - profile=CONDITIONAL ∧ ¬code-detected → status=CONDITIONAL
 *  - profile=NOT_APPLICABLE ∧ code-detected → status=SUSPECTED + 모순 플래그
 *  - profile=NOT_APPLICABLE ∧ ¬code-detected → status=NOT_APPLICABLE (생략)
 */
import type { ObligationId } from "../catalog/schema";
import type { AISystem } from "../synthesizer/schema";
import type { ServiceProfileIntake } from "./schema";
import {
  evaluateProfile,
  type ProfileObligationDecision,
  type ProfileRuleResult,
} from "./rules";

export type MergedObligationStatus =
  | "REQUIRED"        // 발동 확정
  | "SUSPECTED"       // 코드만 감지 — profile은 부정 (모순)
  | "CONDITIONAL"     // profile 조건부 + 코드 미감지
  | "NOT_APPLICABLE"; // 양쪽 모두 발동 사유 없음

export interface MergedObligation {
  obligationId: ObligationId;
  status: MergedObligationStatus;
  triggeredBy: {
    profile: boolean;  // profile rule이 발동
    code: boolean;     // 코드에서 감지
  };
  profileReason?: string;
  codeEvidence: {
    systemIds: string[];   // 트리거한 AISystem ID들
    catalogIds: string[];  // 트리거한 카탈로그 엔트리들
  };
  contradiction?: string;  // profile vs code 모순 사유
}

export type ContradictionKind =
  | "FOREIGN_MODEL_DENIED"   // profile=국내만 BUT 외국 모델 감지
  | "HIGH_IMPACT_DENIED"     // profile=고영향 아님 BUT 고영향 키워드 감지
  | "GENERATIVE_DENIED"      // profile=정보제공만 BUT 생성형 감지
  | "PERSONAL_DATA_DENIED";  // profile=개인정보 없음 BUT 개인정보 처리 신호

export interface ContradictionFlag {
  kind: ContradictionKind;
  message: string;
  evidenceSystemIds: string[];
}

export interface MergedSynthesisResult {
  /** profile 평가 결과 (null = profile 미입력) */
  profileEvaluation: ProfileRuleResult | null;
  /** 의무별 통합 결과 */
  mergedObligations: MergedObligation[];
  /** profile vs code 모순 */
  contradictions: ContradictionFlag[];
}

// ──────────────────────────────────────────────────────────
// 머지 메인
// ──────────────────────────────────────────────────────────

export function mergeProfileAndCode(
  systems: AISystem[],
  profile: ServiceProfileIntake | null
): MergedSynthesisResult {
  if (!profile) {
    // profile 없음 — 코드만으로 의무 산출 (legacy 동작)
    const merged = mergeCodeOnly(systems);
    return {
      profileEvaluation: null,
      mergedObligations: merged,
      contradictions: [],
    };
  }

  const profileEval = evaluateProfile(profile);
  const codeIndex = indexCodeObligations(systems);

  // AI가 코드에서 전혀 감지되지 않으면 — AIBA 의무 적용 대상 자체가 아님.
  // profile상 발동 사유가 있어도 NOT_APPLICABLE로 강등 (대신 사유에 명시).
  if (systems.length === 0) {
    const noAiResults: MergedObligation[] = profileEval.decisions.map((d) => ({
      obligationId: d.obligationId,
      status: "NOT_APPLICABLE" as const,
      triggeredBy: { profile: false, code: false },
      profileReason: `AI 미감지 — ${d.reason} (코드에서 AI 사용 신호 없음)`,
      codeEvidence: { systemIds: [], catalogIds: [] },
    }));
    return {
      profileEvaluation: profileEval,
      mergedObligations: noAiResults,
      contradictions: [],
    };
  }

  const allObligationIds = new Set<ObligationId>([
    ...profileEval.decisions.map((d) => d.obligationId),
    ...codeIndex.keys(),
  ]);

  const mergedObligations: MergedObligation[] = [];
  for (const obId of allObligationIds) {
    const decision = profileEval.decisions.find(
      (d) => d.obligationId === obId
    );
    const codeHit = codeIndex.get(obId);
    const merged = mergeOne(obId, decision, codeHit);
    if (merged) mergedObligations.push(merged);
  }

  // sort by status priority
  const order: Record<MergedObligationStatus, number> = {
    REQUIRED: 0,
    SUSPECTED: 1,
    CONDITIONAL: 2,
    NOT_APPLICABLE: 3,
  };
  mergedObligations.sort((a, b) => order[a.status] - order[b.status]);

  const contradictions = detectContradictions(profile, systems);

  return {
    profileEvaluation: profileEval,
    mergedObligations,
    contradictions,
  };
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

interface CodeObligationHit {
  systemIds: string[];
  catalogIds: string[];
}

function indexCodeObligations(
  systems: AISystem[]
): Map<ObligationId, CodeObligationHit> {
  const index = new Map<ObligationId, CodeObligationHit>();
  for (const s of systems) {
    for (const obId of s.triggeredObligations) {
      const hit = index.get(obId) ?? { systemIds: [], catalogIds: [] };
      if (!hit.systemIds.includes(s.id)) hit.systemIds.push(s.id);
      if (!hit.catalogIds.includes(s.catalogEntryId)) {
        hit.catalogIds.push(s.catalogEntryId);
      }
      index.set(obId, hit);
    }
  }
  return index;
}

function mergeOne(
  obId: ObligationId,
  decision: ProfileObligationDecision | undefined,
  codeHit: CodeObligationHit | undefined
): MergedObligation | null {
  const profileFires =
    decision?.status === "REQUIRED" || decision?.status === "CONDITIONAL";
  const codeFires = !!codeHit && codeHit.systemIds.length > 0;

  // 양쪽 모두 미발동 → 결과에 포함 안 함
  if (!profileFires && !codeFires) {
    if (decision?.status === "NOT_APPLICABLE") {
      return {
        obligationId: obId,
        status: "NOT_APPLICABLE",
        triggeredBy: { profile: false, code: false },
        profileReason: decision.reason,
        codeEvidence: { systemIds: [], catalogIds: [] },
      };
    }
    return null;
  }

  let status: MergedObligationStatus;
  let contradiction: string | undefined;
  if (decision?.status === "REQUIRED") {
    status = "REQUIRED";
  } else if (decision?.status === "CONDITIONAL" && codeFires) {
    status = "REQUIRED"; // 코드로 확정
  } else if (decision?.status === "CONDITIONAL") {
    status = "CONDITIONAL";
  } else if (decision?.status === "NOT_APPLICABLE" && codeFires) {
    status = "SUSPECTED";
    contradiction = `Profile상 발동 사유 없음 ("${decision.reason}") 그러나 코드에서 감지됨 — 재확인 필요`;
  } else if (codeFires && !decision) {
    status = "REQUIRED"; // profile 미평가 의무
  } else {
    status = "CONDITIONAL";
  }

  return {
    obligationId: obId,
    status,
    triggeredBy: {
      profile: decision?.status === "REQUIRED",
      code: codeFires,
    },
    profileReason: decision?.reason,
    codeEvidence: {
      systemIds: codeHit?.systemIds ?? [],
      catalogIds: codeHit?.catalogIds ?? [],
    },
    contradiction,
  };
}

/** profile=null fallback — 코드 기반 의무 그대로 노출 */
function mergeCodeOnly(systems: AISystem[]): MergedObligation[] {
  const index = indexCodeObligations(systems);
  return [...index.entries()].map(([obId, hit]) => ({
    obligationId: obId,
    status: "REQUIRED" as MergedObligationStatus,
    triggeredBy: { profile: false, code: true },
    codeEvidence: { systemIds: hit.systemIds, catalogIds: hit.catalogIds },
  }));
}

// ──────────────────────────────────────────────────────────
// Contradictions
// ──────────────────────────────────────────────────────────

function detectContradictions(
  profile: ServiceProfileIntake,
  systems: AISystem[]
): ContradictionFlag[] {
  const flags: ContradictionFlag[] = [];

  // 1. 외국 모델 부인 — profile.crossBorderTransfer=false BUT 외국 SDK 감지
  if (profile.crossBorderTransfer === false) {
    const foreignSystems = systems.filter((s) => s.isForeignModel);
    if (foreignSystems.length > 0) {
      flags.push({
        kind: "FOREIGN_MODEL_DENIED",
        message: `Profile에서 국외이전 없음으로 입력됐으나 외국 모델 SDK 감지: ${foreignSystems
          .map((s) => `${s.name} (${s.modelProvider})`)
          .join(", ")}`,
        evidenceSystemIds: foreignSystems.map((s) => s.id),
      });
    }
  }

  // 2. 고영향 부인 — profile.highImpactDomains=[] BUT 코드에 HIGH-IMPACT 트리거
  if (
    profile.highImpactDomains.length === 0 &&
    profile.automationLevel !== "AUTOMATED"
  ) {
    const highImpactSystems = systems.filter(
      (s) =>
        s.derivedRiskTier === "high" ||
        s.triggeredObligations.includes("AIBA-HIGH-IMPACT")
    );
    if (highImpactSystems.length > 0) {
      flags.push({
        kind: "HIGH_IMPACT_DENIED",
        message: `Profile상 고영향 분야 미해당이나 코드 키워드/카탈로그가 고영향 추정: ${highImpactSystems
          .map((s) => s.name)
          .join(", ")}`,
        evidenceSystemIds: highImpactSystems.map((s) => s.id),
      });
    }
  }

  // 3. 정보제공만 — profile.automationLevel=INFO_ONLY BUT 생성형 감지
  if (profile.automationLevel === "INFO_ONLY") {
    const generativeSystems = systems.filter((s) => s.isGenerative);
    if (generativeSystems.length > 0) {
      flags.push({
        kind: "GENERATIVE_DENIED",
        message: `Profile상 단순 정보제공이나 생성형 AI SDK 감지: ${generativeSystems
          .map((s) => s.name)
          .join(", ")}`,
        evidenceSystemIds: generativeSystems.map((s) => s.id),
      });
    }
  }

  return flags;
}
