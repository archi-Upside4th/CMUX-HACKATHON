import { Type } from "@google/genai";
import { geminiClient, DIAGNOSIS_MODEL } from "./client";
import type { CompanyProfile, DiagnosisResult } from "@/lib/types";
import {
  obligationsAsContext,
  relevantObligationsFor,
} from "@/lib/laws/ai-basic-act";

// Gemini structured output용 JSON Schema (responseSchema)
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    overallRisk: {
      type: Type.STRING,
      enum: ["high", "medium", "low", "none"],
    },
    summary: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          obligationId: { type: Type.STRING },
          title: { type: Type.STRING },
          legalBasis: { type: Type.STRING },
          applicability: {
            type: Type.STRING,
            enum: ["applicable", "conditional", "not_applicable"],
          },
          riskLevel: {
            type: Type.STRING,
            enum: ["high", "medium", "low", "none"],
          },
          reasoning: { type: Type.STRING },
          actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
          deadline: { type: Type.STRING },
          evidenceTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          "obligationId",
          "title",
          "legalBasis",
          "applicability",
          "riskLevel",
          "reasoning",
          "actionItems",
          "deadline",
          "evidenceTypes",
        ],
        propertyOrdering: [
          "obligationId",
          "title",
          "legalBasis",
          "applicability",
          "riskLevel",
          "reasoning",
          "actionItems",
          "deadline",
          "evidenceTypes",
        ],
      },
    },
    recommendedNextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["overallRisk", "summary", "items", "recommendedNextSteps"],
  propertyOrdering: ["overallRisk", "summary", "items", "recommendedNextSteps"],
};

const SYSTEM_INSTRUCTION = `당신은 한국 AI기본법(2026.1.22 시행) 전문 컴플라이언스 자문가입니다.
주어진 회사 프로필과 법령 조항 컨텍스트를 바탕으로:
1. 어떤 조항이 이 회사에 적용되는지 정확히 판별합니다 (applicable / conditional / not_applicable).
2. 적용된다면 위험 레벨(high/medium/low)을 매깁니다. 의료·금융·채용 등 민감 영역의 자동결정은 항상 high.
3. 회사가 즉시 시행해야 할 구체적이고 실행 가능한 actionItems를 한국어로 작성합니다 (5개 이내, 명령형 동사로 시작).
4. 감사 시 제출할 evidenceTypes (예: "AI 사용 고지문 캡처", "워터마크 적용 정책 문서")를 명시합니다.
5. summary는 임원이 30초 안에 읽을 수 있게 3~4문장.
6. recommendedNextSteps는 우선순위 기준 3개만.

규칙:
- 단순 정보 제공이 아니라 "이 회사가 이걸 안 하면 어떤 위반인지" 명시.
- 추측 금지. 컨텍스트에 없는 조항을 만들지 말 것.
- 모든 출력은 한국어.`;

export async function diagnoseAIBasicAct(
  profile: CompanyProfile
): Promise<DiagnosisResult> {
  const ai = geminiClient();
  const relevant = relevantObligationsFor(
    profile.aiUsages,
    profile.usesForeignAI
  );

  const userPrompt = `## 회사 프로필
- 회사명: ${profile.name}
- 업종: ${profile.industry}
- 임직원 수: ${profile.employeeCount}명
- 연매출: ${profile.annualRevenueKRW.toLocaleString("ko-KR")}원
- 사용 중인 AI 종류: ${profile.aiUsages.join(", ")}
- 해외 빅테크 AI 직접 호출: ${profile.usesForeignAI ? "예" : "아니오"}
- 추가 메모: ${profile.notes ?? "(없음)"}

## 검토 대상 조항 (전체 컨텍스트)
${obligationsAsContext()}

## 1차 트리거된 조항 (이 회사에 우선 검토 필요)
${relevant.map((o) => `- [${o.id}] ${o.title}`).join("\n") || "(없음)"}

## 작업
위 회사에 대해 AI기본법 조항별 진단 결과를 JSON 스키마에 맞춰 출력하세요.
items 배열에는 컨텍스트에 있는 모든 조항을 검토하되, not_applicable인 경우에도 간략히 이유를 적으세요.`;

  const response = await ai.models.generateContent({
    model: DIAGNOSIS_MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }
  return JSON.parse(text) as DiagnosisResult;
}
