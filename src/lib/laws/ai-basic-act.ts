/**
 * AI 기본법 (인공지능 발전과 신뢰 기반 조성 등에 관한 법률)
 * 시행: 2026.1.22
 *
 * Phase 1 MVP — 진단 시 Gemini에 컨텍스트로 주입할 조항 요약.
 * 정식 조문은 국가법령정보센터 연동 시 교체.
 */

export interface LawObligation {
  id: string;
  article: string; // 조항 명
  title: string;
  appliesTo: string; // 적용 대상 자연어 설명
  obligation: string; // 의무 내용
  penalty?: string;
  triggers: string[]; // Gemini가 적용 여부 판단할 때 참고할 키워드
}

export const AI_BASIC_ACT_OBLIGATIONS: LawObligation[] = [
  {
    id: "AIBA-NOTICE",
    article: "AI 기본법 제31조 (이용자 고지 의무)",
    title: "AI 사용 사실 고지",
    appliesTo: "AI 시스템을 이용해 서비스를 제공하는 모든 사업자",
    obligation:
      "이용자에게 AI가 사용된다는 사실, 사용 목적, 주요 의사결정 기준을 사전에 고지해야 함.",
    penalty: "과태료 최대 3,000만원",
    triggers: ["chatbot", "recommendation", "auto_decision", "generative_text", "generative_image", "biometric", "medical"],
  },
  {
    id: "AIBA-WATERMARK",
    article: "AI 기본법 제31조 (생성형 AI 표시)",
    title: "생성형 AI 결과물 표시 (워터마크)",
    appliesTo: "생성형 AI를 활용해 콘텐츠를 만드는 사업자",
    obligation:
      "생성형 AI가 만든 결과물에는 식별 가능한 표시(워터마크 등)를 부착해야 함. 가상 인물·합성 콘텐츠 명시.",
    penalty: "과태료 최대 3,000만원",
    triggers: ["generative_text", "generative_image"],
  },
  {
    id: "AIBA-HIGH-IMPACT",
    article: "AI 기본법 제32조 (고영향 AI 위험관리)",
    title: "고영향 AI 위험관리 체계 구축",
    appliesTo:
      "고영향 AI(① 학습 연산량 10²⁶ FLOPs 이상, ② 기본권·생명·안전에 중대한 영향, ③ 최첨단 기술 활용 — 3요소 중 어느 하나) 운영자",
    obligation:
      "위험성 평가, 위험 완화 조치, 사후 모니터링, 영향 평가 보고서 작성·비치 의무. 의료·금융·채용 등 민감 영역에서 자동결정에 사용 시 사실상 해당.",
    penalty: "시정명령 + 과태료, 2027년 본격 제재",
    triggers: ["auto_decision", "medical", "biometric"],
  },
  {
    id: "AIBA-FOREIGN-REP",
    article: "AI 기본법 제35조 (국내 대리인 지정)",
    title: "해외 사업자 국내 대리인 지정",
    appliesTo:
      "국내에 영업소가 없는 해외 AI 사업자의 서비스를 활용해 국내 이용자에게 서비스를 제공하는 기업",
    obligation:
      "해외 AI 모델/서비스를 직접 호출해 국내 이용자에게 제공할 경우, 해외 사업자가 국내 대리인을 지정했는지 확인 의무. 미지정 시 서비스 차단 가능.",
    triggers: ["usesForeignAI"],
  },
  {
    id: "AIBA-RISK-MGMT",
    article: "AI 기본법 제32조 (위험관리 체계)",
    title: "AI Risk Register 구축 및 운영",
    appliesTo: "AI를 업무에 활용하는 모든 사업자 (사실상 거의 전부)",
    obligation:
      "사용 중인 AI 시스템 목록, 위험등급 분류, 완화 조치 기록, 정기 재평가를 문서화한 위험관리 체계 구축. 감사 시 제출 가능한 형태로 비치.",
    triggers: ["chatbot", "recommendation", "generative_text", "generative_image", "auto_decision", "biometric", "medical"],
  },
  {
    id: "AIBA-DATA-GOVERNANCE",
    article: "AI 기본법 제33조 (데이터 거버넌스)",
    title: "학습 데이터 출처·편향 관리",
    appliesTo: "AI 모델을 자체 학습·파인튜닝하는 사업자",
    obligation:
      "학습 데이터 출처 기록, 저작권/개인정보 적법성 확인, 편향성 평가 결과 비치.",
    triggers: ["generative_text", "generative_image", "auto_decision"],
  },
  {
    id: "AIBA-HIGH-COMPUTE",
    article: "AI 기본법 제32조 (대규모 AI 모델 특칙)",
    title: "초대규모 학습 모델 신고·평가",
    appliesTo: "누적 학습 연산량 10²⁶ FLOPs 이상 모델을 자체 학습하는 사업자 (frontier model)",
    obligation:
      "학습 연산량·자원·기간 신고, 모델 능력·위험 사전 평가, 안전성 검증 절차 운영.",
    penalty: "시정명령 + 과태료",
    triggers: ["high_compute_training"],
  },
  {
    id: "AIBA-PUBLIC-DISCLOSURE",
    article: "AI 기본법 제34조 (운영 정보 공개)",
    title: "AI 시스템 공개 정보 게시",
    appliesTo: "프로덕션 단계의 고영향/생성형 AI 시스템 운영자",
    obligation:
      "AI 사용 사실, 위험관리 체계 요약, 책임자 연락처를 사용자가 접근 가능한 채널에 공개.",
    triggers: ["high_impact_production", "generative_production"],
  },
  {
    id: "AIBA-IMPACT-ASSESSMENT",
    article: "AI 기본법 제33조 (영향평가)",
    title: "고영향 AI 영향평가 보고서",
    appliesTo: "고영향 AI(의료/금융/채용/생체식별/공공의사결정 등) 운영자",
    obligation:
      "이해관계자·기본권·차별 영향 평가 보고서 작성, 정기 갱신, 감사 요청 시 제출.",
    penalty: "과태료 최대 3,000만원",
    triggers: ["auto_decision", "medical", "biometric", "high_impact_production"],
  },
];

export function relevantObligationsFor(usages: string[], usesForeignAI: boolean): LawObligation[] {
  const triggers = new Set(usages);
  if (usesForeignAI) triggers.add("usesForeignAI");
  return AI_BASIC_ACT_OBLIGATIONS.filter((o) =>
    o.triggers.some((t) => triggers.has(t))
  );
}

export function obligationsAsContext(): string {
  return AI_BASIC_ACT_OBLIGATIONS.map(
    (o) =>
      `[${o.id}] ${o.article} — ${o.title}\n  적용대상: ${o.appliesTo}\n  의무: ${o.obligation}${o.penalty ? `\n  제재: ${o.penalty}` : ""}`
  ).join("\n\n");
}
