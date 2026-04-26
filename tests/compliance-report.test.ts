import { describe, expect, it } from "vitest";
import { parseComplianceReportResponse } from "@/lib/gemini/compliance-report";

const rawReport = {
  executiveSummary:
    "이 서비스는 외부 생성형 AI를 활용하므로 고지와 위험관리 체계가 우선 필요합니다.",
  overallRisk: "medium",
  riskRegister: [
    {
      id: "risk-1",
      title: "이용자 고지 누락",
      severity: 4,
      likelihood: 3,
      impact: "이용자 분쟁과 규제 리스크가 커질 수 있습니다.",
      affectedSystemIds: ["sys-1"],
      affectedObligations: ["AIBA-NOTICE"],
      mitigation: "이용자 고지 문구를 제품 진입 화면에 배치하십시오.",
      owner: "product",
    },
  ],
  systemAnalyses: [
    {
      systemId: "sys-1",
      role: "사용자 질문에 자연어 답변을 생성합니다.",
      dataFlow: "사용자 입력이 외부 모델로 전달되고 응답이 다시 사용자에게 반환됩니다.",
      crossSystemInteractions: [],
      riskNarrative:
        "외부 모델 출력이 바로 노출되므로 잘못된 답변이 서비스 신뢰를 해칠 수 있습니다.",
      mitigations: ["검토 가능한 답변 로그를 남기십시오."],
      auditableArtifacts: ["AI 사용 고지 정책 v1.0"],
    },
  ],
  obligationDeepDive: [
    {
      obligationId: "AIBA-NOTICE",
      title: "AI 사용 사실 고지",
      applicability: "applicable",
      rationale:
        "사용자에게 AI 기반 응답이 직접 노출되므로 사전 고지가 필요합니다.",
      triggeringSystems: ["sys-1"],
      requiredEvidence: ["AI 사용 고지 정책 v1.0"],
      immediateActions: ["이용자 고지 문구를 배포하십시오."],
      longTermActions: ["고지 문구 정기 검토 절차를 수립하십시오."],
      blockers: [],
      citations: [
        {
          text: "인공지능사업자는 인공지능시스템을 이용한 제품 또는 서비스를 제공할 때 해당 제품 또는 서비스가 인공지능에 기반하여 운용된다는 사실을 이용자가 사전에 명확히 알 수 있도록 고지하여야 한다.",
        },
      ],
    },
  ],
  roadmap: {
    p1_urgent: [
      {
        title: "이용자 고지 반영",
        owner: "product",
        effort: "S",
        relatedObligations: ["AIBA-NOTICE"],
      },
    ],
    p2_important: [],
    p3_planned: [],
  },
  openQuestions: [],
};

describe("parseComplianceReportResponse", () => {
  it("accepts Gemini raw citations without verifiedLocator", () => {
    const parsed = parseComplianceReportResponse(JSON.stringify(rawReport));

    expect(parsed.obligationDeepDive[0].citations[0].verifiedLocator).toBe(
      "제31조 제1항"
    );
    expect(parsed.obligationDeepDive[0].verified).toBe(true);
  });

  it("extracts JSON from fenced responses", () => {
    const fenced = `분석 결과입니다.
\`\`\`json
${JSON.stringify(rawReport, null, 2)}
\`\`\`
후속 검토가 필요합니다.`;

    const parsed = parseComplianceReportResponse(fenced);

    expect(parsed.executiveSummary).toContain("외부 생성형 AI");
    expect(parsed.riskRegister).toHaveLength(1);
  });
});
