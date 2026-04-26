import { Type } from "@google/genai";
import { geminiClient, DIAGNOSIS_MODEL } from "./client";
import type { CompanyProfile, DiagnosisItem, DiagnosisResult } from "@/lib/types";
import {
  KNOWN_OBLIGATION_IDS,
  isKnownObligationId,
  obligationsAsContext,
  relevantObligationsFor,
  verifyCitation,
} from "@/lib/laws/ai-basic-act";

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
          obligationId: { type: Type.STRING, enum: KNOWN_OBLIGATION_IDS },
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
          citations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
              },
              required: ["text"],
              propertyOrdering: ["text"],
            },
          },
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
          "citations",
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
          "citations",
        ],
      },
    },
    recommendedNextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["overallRisk", "summary", "items", "recommendedNextSteps"],
  propertyOrdering: ["overallRisk", "summary", "items", "recommendedNextSteps"],
};

const SYSTEM_INSTRUCTION = `당신은 한국 AI기본법(2026.1.22 시행) 컴플라이언스 자문가입니다.
주어진 회사 프로필과 RAG로 제공된 9개 의무의 조문 발췌를 바탕으로 판단합니다.

규칙 (위반 시 응답이 폐기됨):
1. obligationId는 제공된 9개 ID 중에서만 선택. 다른 ID 금지.
2. legalBasis는 RAG 컨텍스트에 적힌 article 문구를 그대로 사용 (창작 금지).
3. citations 배열에는 RAG 컨텍스트의 "근거 발췌" 인용구를 그대로 복사해 1개 이상 넣을 것.
   - 인용은 30자 이상의 의미 있는 문장이어야 함.
   - 발췌에 없는 문장을 만들어 넣지 말 것 (자동 검증으로 차단됨).
   - applicability=not_applicable이라도 어떤 조문이 그렇게 만드는지 인용 1건 필수.
4. 추측 금지. 의무에 적용 가능성을 모르면 conditional + 사유를 reasoning에 명시.

출력 작성 가이드:
- summary: 임원 30초 요약 3~4문장.
- reasoning: 회사 프로필의 어느 요소가 어떤 조문에 매칭되는지 직접 연결.
- actionItems: 명령형 동사로 시작, 5개 이내, 구체적 산출물·소유자 포함.
- evidenceTypes: 감사 시 제출 가능한 산출물 명사구 (예: "AI 사용 고지 정책 v1.0").
- recommendedNextSteps: 우선순위 Top 3.

모든 출력은 한국어.`;

interface RawItem extends Omit<DiagnosisItem, "citations" | "verified"> {
  citations: { text: string }[];
}

interface RawResponse {
  overallRisk: DiagnosisResult["overallRisk"];
  summary: string;
  items: RawItem[];
  recommendedNextSteps: string[];
}

function verifyItems(raw: RawResponse): DiagnosisResult {
  const items: DiagnosisItem[] = raw.items
    .filter((it) => isKnownObligationId(it.obligationId))
    .map((it) => {
      const verifiedCitations = (it.citations ?? []).map((c) => {
        const r = verifyCitation(it.obligationId, c.text);
        return {
          text: c.text,
          verifiedLocator: r.ok ? r.locator : null,
        };
      });
      const hasVerified = verifiedCitations.some(
        (c) => c.verifiedLocator !== null
      );
      return {
        ...it,
        citations: verifiedCitations,
        verified:
          hasVerified || it.applicability === "not_applicable"
            ? hasVerified
            : false,
      };
    });

  return {
    overallRisk: raw.overallRisk,
    summary: raw.summary,
    items,
    recommendedNextSteps: raw.recommendedNextSteps ?? [],
  };
}

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

## RAG: AI기본법 9개 의무 (인용은 반드시 이 안에서)
${obligationsAsContext()}

## 1차 트리거된 조항 (이 회사에 우선 검토 필요)
${relevant.map((o) => `- [${o.id}] ${o.title}`).join("\n") || "(없음)"}

## 작업
items 배열에는 위 9개 의무 ID 모두 포함. not_applicable이라도 근거 인용 1건 첨부.`;

  const response = await ai.models.generateContent({
    model: DIAGNOSIS_MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.15,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }
  const raw = JSON.parse(text) as RawResponse;
  return verifyItems(raw);
}
