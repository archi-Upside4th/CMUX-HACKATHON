/**
 * Gemini Step B — RepoContext에서 ServiceProfile 추론.
 *
 * "이 저장소가 어떤 서비스인지" 한 번에 정의 → 다음 Step C(ComplianceReport)의 공통 컨텍스트.
 */
import { Type } from "@google/genai";
import { geminiClient, DIAGNOSIS_MODEL } from "./client";
import {
  type RepoContext,
  ServiceProfileSchema,
  type ServiceProfile,
} from "@/lib/report/schema";
import type { AISystem } from "@/lib/scan/synthesizer/schema";

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    servicePurpose: { type: Type.STRING },
    userTypes: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: ["end_user", "internal_admin", "developer", "anonymous"],
      },
    },
    primaryDomain: {
      type: Type.STRING,
      enum: [
        "credit_finance",
        "employment",
        "healthcare",
        "biometric_id",
        "law_enforcement",
        "education",
        "general",
      ],
    },
    dataSensitivity: {
      type: Type.STRING,
      enum: ["high", "medium", "low"],
    },
    dataKinds: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: [
          "pii",
          "financial",
          "health",
          "biometric",
          "behavioral",
          "none",
        ],
      },
    },
    decisionAutomation: {
      type: Type.STRING,
      enum: ["none", "advisory", "human_in_loop", "fully_automated"],
    },
    customerExposure: { type: Type.BOOLEAN },
    reasoning: { type: Type.STRING },
    evidenceFiles: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "servicePurpose",
    "userTypes",
    "primaryDomain",
    "dataSensitivity",
    "dataKinds",
    "decisionAutomation",
    "customerExposure",
    "reasoning",
    "evidenceFiles",
  ],
  propertyOrdering: [
    "servicePurpose",
    "userTypes",
    "primaryDomain",
    "dataSensitivity",
    "dataKinds",
    "decisionAutomation",
    "customerExposure",
    "reasoning",
    "evidenceFiles",
  ],
};

const SYSTEM_INSTRUCTION = `당신은 한국 AI기본법(2026.1.22 시행) 컴플라이언스 자문가입니다.
입력으로 GitHub 저장소의 정적 분석 컨텍스트(README, 매니페스트, 라우트, 인증, 스키마, AI 시스템 호출 스니펫)를 받습니다.

이 저장소가 **무슨 서비스인지** 한 번에 추론하여 JSON 스키마에 맞춰 출력합니다.

판단 원칙:
- servicePurpose: 한 줄로. "B2C 핀테크 대출 심사 자동화 SaaS" 같은 형태.
- userTypes: 코드 + README + 라우트 구조에서 누가 쓰는 서비스인지 추론.
- primaryDomain: 가장 무거운 도메인 1개. 신용금융 > 의료 > 채용 > 생체인식 > 법집행 > 교육 > general 순으로 판단.
- dataSensitivity: 처리하는 데이터의 민감도. 금융/의료/생체 = high, 일반 텍스트만 = low.
- decisionAutomation: AI 시스템이 사용자에게 영향을 주는 결정을 만드는 방식.
  - none: AI가 결정 안 함 (단순 보조)
  - advisory: 사람이 보고 참고만
  - human_in_loop: AI 추천 + 사람 승인
  - fully_automated: AI 결정이 그대로 사용자에게 적용
- customerExposure: AI 결과물이 외부 사용자에게 직접 노출되는가?
- reasoning: 위 판단의 근거 3~5문장.
- evidenceFiles: 판단 근거가 된 파일 경로.

규칙:
- 추측하지 말고 컨텍스트에 있는 신호만 사용.
- 신호가 부족하면 보수적으로 판단 (general / medium / advisory).
- 모든 출력은 한국어.`;

interface Input {
  repoUrl: string;
  context: RepoContext;
  systems: AISystem[];
}

export async function inferServiceProfile(
  input: Input
): Promise<ServiceProfile> {
  const ai = geminiClient();

  // 시스템 요약은 짧게 — Step C에서 디테일 사용
  const systemSummaries = input.systems.slice(0, 20).map((s) => ({
    id: s.id,
    name: s.name,
    domains: s.domains,
    isGenerative: s.isGenerative,
    isForeignModel: s.isForeignModel,
    purpose: s.purpose,
  }));

  const userPrompt = `## 저장소 URL
${input.repoUrl}

## 메타
- serviceName: ${input.context.serviceName ?? "(없음)"}
- serviceDescription: ${input.context.serviceDescription ?? "(없음)"}
- keywords: ${input.context.keywords.join(", ") || "(없음)"}
- packageManagers: ${input.context.packageManagers.join(", ") || "(없음)"}
- authMechanism: ${input.context.authMechanism}
- storageBackends: ${input.context.storageBackends.join(", ") || "(없음)"}
- envVarsDeclared: ${input.context.envVarsDeclared.slice(0, 30).join(", ") || "(없음)"}

## 스크립트 (개발/배포)
${
  Object.entries(input.context.scripts)
    .slice(0, 12)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n") || "(없음)"
}

## 공개 라우트 (상위 30개)
${
  input.context.publicRoutes
    .slice(0, 30)
    .map((r) => `- ${r.method} ${r.path}  (${r.handlerFile})`)
    .join("\n") || "(없음)"
}

## 페이지 (상위 30개)
${input.context.pages.slice(0, 30).join("\n") || "(없음)"}

## 스키마 파일
${
  input.context.schemaFiles
    .slice(0, 10)
    .map((s) => `- [${s.kind}] ${s.path}`)
    .join("\n") || "(없음)"
}

## README 발췌 (앞부분)
\`\`\`
${input.context.readmeExcerpt.slice(0, 3000) || "(README 없음)"}
\`\`\`

## 검출된 AI 시스템 요약
${JSON.stringify(systemSummaries, null, 2)}

## 작업
JSON 스키마에 맞춰 ServiceProfile 출력. 모든 필드 한국어.`;

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
  if (!text) throw new Error("ServiceProfile Gemini 응답이 비어 있습니다.");

  const parsed = ServiceProfileSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(
      `ServiceProfile 스키마 검증 실패: ${parsed.error.message}`
    );
  }
  return parsed.data;
}
