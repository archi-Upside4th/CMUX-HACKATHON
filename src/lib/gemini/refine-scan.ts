/**
 * Gemini refine — 결정적 synthesizer 결과를 사람이 읽을 수 있는 서술로 보강.
 *
 * 입력: AISystem[] + repo meta
 * 출력: ScanRefinement (overall + per-system humanSummary/riskNarrative/mitigations/priority/gaps)
 *
 * 규칙:
 * - 결정적 결과(name/derivedRiskTier/triggeredObligations 등)는 절대 수정하지 않음
 * - 추가 서술 필드만 생성
 * - GEMINI_API_KEY 없으면 호출부에서 null 반환 (graceful degrade)
 */
import { Type } from "@google/genai";
import { z } from "zod";
import { withGemini, DIAGNOSIS_MODEL } from "./client";
import type { AISystem } from "@/lib/scan/synthesizer/schema";
import { obligationsAsContext } from "@/lib/laws/ai-basic-act";

export const RefinedSystemSchema = z.object({
  systemId: z.string(),
  humanSummary: z.string(),
  riskNarrative: z.string(),
  mitigations: z.array(z.string()),
  priorityScore: z.number().int().min(1).max(5),
  gaps: z.array(z.string()),
});
export type RefinedSystem = z.infer<typeof RefinedSystemSchema>;

export const ScanRefinementSchema = z.object({
  overallSummary: z.string(),
  topPriority: z.string(),
  systems: z.array(RefinedSystemSchema),
});
export type ScanRefinement = z.infer<typeof ScanRefinementSchema>;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    overallSummary: { type: Type.STRING },
    topPriority: { type: Type.STRING },
    systems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          systemId: { type: Type.STRING },
          humanSummary: { type: Type.STRING },
          riskNarrative: { type: Type.STRING },
          mitigations: { type: Type.ARRAY, items: { type: Type.STRING } },
          priorityScore: { type: Type.INTEGER },
          gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          "systemId",
          "humanSummary",
          "riskNarrative",
          "mitigations",
          "priorityScore",
          "gaps",
        ],
        propertyOrdering: [
          "systemId",
          "humanSummary",
          "riskNarrative",
          "mitigations",
          "priorityScore",
          "gaps",
        ],
      },
    },
  },
  required: ["overallSummary", "topPriority", "systems"],
  propertyOrdering: ["overallSummary", "topPriority", "systems"],
};

const SYSTEM_INSTRUCTION = `당신은 한국 AI기본법(2026.1.22 시행) 컴플라이언스 자문가입니다.
정적 코드 분석으로 도출된 AI 시스템 목록을 받아, **법무/리스크 담당자(비기술자)**가 이해할 수 있도록 서술합니다.

규칙:
- 입력으로 받은 결정적 정보(이름, 위험등급, 트리거된 의무)는 절대 변경하지 않습니다.
- 각 시스템에 대해 아래 5개 필드만 생성합니다:
  1) humanSummary: "이 시스템이 무엇을 하는지" 2문장 한국어. 라이브러리/카탈로그 이름이 아닌 "비즈니스 행위" 중심으로.
  2) riskNarrative: 왜 이 위험등급(high/medium/low)이 매겨졌는지 근거 + 우려 시나리오 1개. 3~4문장.
  3) mitigations: "이 행동을 하면 위험이 내려간다" 형식의 실행 가능한 조치 3~5개. 명령형 동사로 시작.
  4) priorityScore: 1(긴급)~5(여유) 정수. 위험등급/도메인/생성형 여부를 종합해 결정.
  5) gaps: 정보가 부족해 추가 확인이 필요한 영역. 예: "이미지 생성 호출 발견되었으나 워터마크 적용 코드 없음".
- overallSummary: 전체 저장소가 직면한 핵심 리스크 2~3문장.
- topPriority: 가장 먼저 처리해야 할 시스템 1개 (이름 + 한 문장 이유).

금지:
- 입력에 없는 의무 ID 만들지 말 것.
- 코드 라이브러리 이름을 그대로 나열하지 말 것 — 비즈니스 영향 중심으로.
- 추측성 단정 금지 — 불확실한 부분은 gaps에 명시.

모든 출력은 한국어.`;

interface RefineInput {
  repoUrl: string;
  systems: AISystem[];
  unattributedRuleIds: string[];
  languageStats: Record<string, number>;
}

export async function refineScan(
  input: RefineInput
): Promise<ScanRefinement> {
  if (input.systems.length === 0) {
    return {
      overallSummary:
        "검출된 AI 시스템이 없습니다. AI기본법 의무 트리거 없음.",
      topPriority: "해당 없음 — AI 시스템 미검출.",
      systems: [],
    };
  }

  // 입력 토큰 절약: 상위 10개만 refine. 더 많으면 결정적 결과만 유지.
  const top = input.systems.slice(0, 10);

  const systemsForPrompt = top.map((s) => ({
    systemId: s.id,
    name: s.name,
    purpose: s.purpose,
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
    evidenceFilePaths: s.evidence.filePaths.slice(0, 8),
    matchedRuleIds: s.evidence.ruleIds,
  }));

  const userPrompt = `## 저장소 메타
- URL: ${input.repoUrl}
- 언어 통계: ${Object.entries(input.languageStats)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ") || "(없음)"}
- 라이브러리 비매칭 패턴 룰 IDs: ${input.unattributedRuleIds.slice(0, 10).join(", ") || "(없음)"}

## 검출된 AI 시스템 (결정적 분석 결과)
${JSON.stringify(systemsForPrompt, null, 2)}

## AI기본법 의무 컨텍스트
${obligationsAsContext()}

## 작업
위 시스템 ${top.length}개에 대해 JSON 스키마에 맞춰 서술 필드를 생성하세요.
systemId는 입력 그대로 유지. 시스템 순서와 동일하게 출력.`;

  const response = await withGemini((ai) =>
    ai.models.generateContent({
      model: DIAGNOSIS_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.2,
      },
    })
  );

  const text = response.text;
  if (!text) throw new Error("Gemini refine 응답이 비어 있습니다.");

  const parsed = ScanRefinementSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(
      `Gemini refine 출력 스키마 검증 실패: ${parsed.error.message}`
    );
  }
  return parsed.data;
}
