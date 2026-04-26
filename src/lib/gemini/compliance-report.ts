/**
 * Gemini Step C — Holistic Compliance Report.
 *
 * 입력: ServiceProfile + AISystem[] + RepoContext (호출 스니펫 포함)
 * 출력: ComplianceReport (executive summary + risk register + system analyses
 *        + obligation deep-dive + roadmap + open questions)
 */
import { Type } from "@google/genai";
import { withGemini, DIAGNOSIS_MODEL } from "./client";
import {
  ComplianceReportSchema,
  type ComplianceReport,
  type RepoContext,
  type ServiceProfile,
} from "@/lib/report/schema";
import type { AISystem } from "@/lib/scan/synthesizer/schema";
import {
  KNOWN_OBLIGATION_IDS,
  isKnownObligationId,
  obligationsAsContext,
  unsupportedArticleRefs,
  verifyCitation,
} from "@/lib/laws/ai-basic-act";

const ownerEnum = ["engineering", "legal", "product", "security", "executive"];

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: { type: Type.STRING },
    overallRisk: { type: Type.STRING, enum: ["high", "medium", "low"] },
    riskRegister: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          severity: { type: Type.INTEGER },
          likelihood: { type: Type.INTEGER },
          impact: { type: Type.STRING },
          affectedSystemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          affectedObligations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          mitigation: { type: Type.STRING },
          owner: { type: Type.STRING, enum: ownerEnum },
        },
        required: [
          "id",
          "title",
          "severity",
          "likelihood",
          "impact",
          "affectedSystemIds",
          "affectedObligations",
          "mitigation",
          "owner",
        ],
        propertyOrdering: [
          "id",
          "title",
          "severity",
          "likelihood",
          "impact",
          "affectedSystemIds",
          "affectedObligations",
          "mitigation",
          "owner",
        ],
      },
    },
    systemAnalyses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          systemId: { type: Type.STRING },
          role: { type: Type.STRING },
          dataFlow: { type: Type.STRING },
          crossSystemInteractions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          riskNarrative: { type: Type.STRING },
          mitigations: { type: Type.ARRAY, items: { type: Type.STRING } },
          auditableArtifacts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          "systemId",
          "role",
          "dataFlow",
          "crossSystemInteractions",
          "riskNarrative",
          "mitigations",
          "auditableArtifacts",
        ],
        propertyOrdering: [
          "systemId",
          "role",
          "dataFlow",
          "crossSystemInteractions",
          "riskNarrative",
          "mitigations",
          "auditableArtifacts",
        ],
      },
    },
    obligationDeepDive: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          obligationId: { type: Type.STRING, enum: KNOWN_OBLIGATION_IDS },
          title: { type: Type.STRING },
          applicability: {
            type: Type.STRING,
            enum: ["applicable", "conditional", "not_applicable"],
          },
          rationale: { type: Type.STRING },
          triggeringSystems: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          requiredEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
          immediateActions: { type: Type.ARRAY, items: { type: Type.STRING } },
          longTermActions: { type: Type.ARRAY, items: { type: Type.STRING } },
          blockers: { type: Type.ARRAY, items: { type: Type.STRING } },
          citations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { text: { type: Type.STRING } },
              required: ["text"],
              propertyOrdering: ["text"],
            },
          },
        },
        required: [
          "obligationId",
          "title",
          "applicability",
          "rationale",
          "triggeringSystems",
          "requiredEvidence",
          "immediateActions",
          "longTermActions",
          "blockers",
          "citations",
        ],
        propertyOrdering: [
          "obligationId",
          "title",
          "applicability",
          "rationale",
          "triggeringSystems",
          "requiredEvidence",
          "immediateActions",
          "longTermActions",
          "blockers",
          "citations",
        ],
      },
    },
    roadmap: {
      type: Type.OBJECT,
      properties: {
        p1_urgent: { type: Type.ARRAY, items: actionItemSchema() },
        p2_important: { type: Type.ARRAY, items: actionItemSchema() },
        p3_planned: { type: Type.ARRAY, items: actionItemSchema() },
      },
      required: ["p1_urgent", "p2_important", "p3_planned"],
      propertyOrdering: ["p1_urgent", "p2_important", "p3_planned"],
    },
    openQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "executiveSummary",
    "overallRisk",
    "riskRegister",
    "systemAnalyses",
    "obligationDeepDive",
    "roadmap",
    "openQuestions",
  ],
  propertyOrdering: [
    "executiveSummary",
    "overallRisk",
    "riskRegister",
    "systemAnalyses",
    "obligationDeepDive",
    "roadmap",
    "openQuestions",
  ],
};

function actionItemSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      owner: { type: Type.STRING, enum: ownerEnum },
      effort: { type: Type.STRING, enum: ["S", "M", "L"] },
      relatedObligations: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["title", "owner", "effort", "relatedObligations"],
    propertyOrdering: ["title", "owner", "effort", "relatedObligations"],
  };
}

const SYSTEM_INSTRUCTION = `당신은 한국 AI기본법(2026.1.22 시행) 컴플라이언스 자문가입니다.
입력: 서비스 프로필 + 검출된 AI 시스템 목록 + 호출 컨텍스트 + 9개 의무 조문.
출력: 임원/법무/엔지니어 모두에게 유용한 **회사용 종합 컴플라이언스 리포트**.

원칙:
1) executiveSummary: 임원 30초 요약 4~5문장. 가장 큰 리스크와 예상 위반 결과를 명시.
2) overallRisk: 전체 서비스 위험도 — 시스템 위험등급 + 도메인 + 사용자 노출도 종합.
3) riskRegister: 5~10개. severity(1=낮음~5=치명) × likelihood(1=희박~5=확실).
   - 단일 시스템이 아닌 "결합 리스크"도 포함 (예: 외부 LLM + 사용자 노출 + 신용 데이터 = high).
   - mitigation은 명령형 동사로 시작.
4) systemAnalyses: 입력으로 받은 시스템 ID 모두 분석. 다른 시스템과의 상호작용도 명시.
   - auditableArtifacts: 감사 시 제출할 구체 산출물 이름 (예: "AI 사용 고지 정책 v1.0", "생성물 워터마크 적용 표준 §3").
5) obligationDeepDive: 9개 의무 모두 평가. applicability + 근거 + 필요 증거 + 즉시조치(30일) + 장기조치(90일) + 막힌 의사결정.
   - citations: 9개 의무 컨텍스트의 "근거 발췌"에서 인용구를 그대로 복사해 1건 이상 첨부.
   - 인용은 30자 이상의 의미 있는 문장. 발췌 풀에 없는 문장 창작 금지 (자동 검증으로 차단).
6) roadmap:
   - p1_urgent (30일): 위반 위험 즉시 회피용
   - p2_important (90일): 시행일(2026-01-22) 전 완료
   - p3_planned (분기): 운영 정착
   - effort: S(<1주) / M(1~4주) / L(>4주)
7) openQuestions: 인간(법무/PO)이 답해야 할 정보 부족 항목.

금지:
- 컨텍스트에 없는 의무 ID 만들지 말 것 (입력의 9개 의무 ID만 사용).
- 라이브러리 이름 나열 금지 — 비즈니스 행위 중심 서술.
- 추측 단정 금지 — 불확실하면 openQuestions로 옮길 것.

모든 출력은 한국어.`;

interface Input {
  repoUrl: string;
  serviceProfile: ServiceProfile;
  systems: AISystem[];
  context: RepoContext;
}

const SYSTEM_LIMIT = 15; // 토큰 예산 — 상위 15개만

export async function buildComplianceReport(
  input: Input
): Promise<ComplianceReport> {
  const systems = input.systems.slice(0, SYSTEM_LIMIT);
  const callCtxBySystem = new Map(
    input.context.systemCallContexts.map((c) => [c.systemId, c])
  );

  const systemDetails = systems.map((s) => ({
    id: s.id,
    name: s.name,
    catalogEntryId: s.catalogEntryId,
    procurement: s.procurement,
    modelProvider: s.modelProvider,
    modelName: s.modelName,
    isForeignModel: s.isForeignModel,
    domains: s.domains,
    modalities: s.modalities,
    isGenerative: s.isGenerative,
    trainsOrFineTunes: s.trainsOrFineTunes,
    derivedRiskTier: s.derivedRiskTier,
    triggeredObligations: s.triggeredObligations,
    confidence: s.confidence,
    callContext: callCtxBySystem.get(s.id)?.callSites.slice(0, 4) ?? [],
  }));

  const userPrompt = `## 저장소
${input.repoUrl}

## ServiceProfile (Step B 산출)
${JSON.stringify(input.serviceProfile, null, 2)}

## AI 시스템 상세 (상위 ${systems.length}개, 호출 컨텍스트 포함)
${JSON.stringify(systemDetails, null, 2)}

## 추가 서비스 메타
- authMechanism: ${input.context.authMechanism}
- storageBackends: ${input.context.storageBackends.join(", ") || "(없음)"}
- 공개 라우트 수: ${input.context.publicRoutes.length}
- 페이지 수: ${input.context.pages.length}
- 스키마 파일: ${input.context.schemaFiles.map((s) => s.kind).join(", ") || "(없음)"}

## 9개 의무 컨텍스트 (이 ID들만 사용)
${obligationsAsContext()}

## 작업
JSON 스키마에 맞춰 ComplianceReport 출력.
- 모든 시스템 ID는 입력 그대로 유지.
- obligationDeepDive는 9개 의무 모두 포함 (not_applicable이라도).
- riskRegister는 우선순위 높은 것부터.`;

  const response = await withGemini((ai) =>
    ai.models.generateContent({
      model: DIAGNOSIS_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.25,
        maxOutputTokens: 16_000,
      },
    })
  );

  const text = response.text;
  if (!text)
    throw new Error("ComplianceReport Gemini 응답이 비어 있습니다.");

  const parsed = ComplianceReportSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(
      `ComplianceReport 스키마 검증 실패: ${parsed.error.message}`
    );
  }

  const verifiedDeepDive = [];
  for (const o of parsed.data.obligationDeepDive) {
    if (!isKnownObligationId(o.obligationId)) {
      console.warn(
        `[compliance-report] dropped obligation with unknown id: ${o.obligationId}`
      );
      continue;
    }
    const checked = (o.citations ?? []).map((c) => {
      const r = verifyCitation(o.obligationId, c.text);
      return { text: c.text, verifiedLocator: r.ok ? r.locator : null };
    });
    const hasVerifiedCitation = checked.some(
      (c) => c.verifiedLocator !== null
    );
    const unsupportedRefs = unsupportedArticleRefs(
      o.obligationId,
      o.rationale ?? "",
      ...(o.immediateActions ?? []),
      ...(o.longTermActions ?? []),
      ...(o.requiredEvidence ?? [])
    );
    verifiedDeepDive.push({
      ...o,
      citations: checked,
      verified: hasVerifiedCitation && unsupportedRefs.length === 0,
      unsupportedRefs,
    });
  }

  return { ...parsed.data, obligationDeepDive: verifiedDeepDive };
}
