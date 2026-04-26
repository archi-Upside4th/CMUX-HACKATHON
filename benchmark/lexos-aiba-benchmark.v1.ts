export type ObligationId =
  | "AIBA-NOTICE"
  | "AIBA-WATERMARK"
  | "AIBA-HIGH-IMPACT"
  | "AIBA-FOREIGN-REP"
  | "AIBA-RISK-MGMT"
  | "AIBA-DATA-GOVERNANCE"
  | "AIBA-HIGH-COMPUTE"
  | "AIBA-PUBLIC-DISCLOSURE"
  | "AIBA-IMPACT-ASSESSMENT";

export type AIUsage =
  | "chatbot"
  | "recommendation"
  | "generative_text"
  | "generative_image"
  | "auto_decision"
  | "biometric"
  | "medical"
  | "none";

export type RiskLevel = "high" | "medium" | "low" | "none";
export type CompliancePosture = "good" | "mixed" | "poor";
export type ScenarioMode = "company_profile" | "scan_blueprint";

export interface CompanyProfileInput {
  name: string;
  industry: string;
  employeeCount: number;
  annualRevenueKRW: number;
  aiUsages: AIUsage[];
  usesForeignAI: boolean;
  notes: string;
}

export interface RepoBlueprintSignal {
  path: string;
  summary: string;
}

export interface RepoBlueprintInput {
  repoName: string;
  repoStory: string;
  languages: string[];
  manifestDeps: string[];
  sourceSignals: RepoBlueprintSignal[];
  uiSignals: string[];
  complianceSignals: string[];
}

export interface ExpectedSystemDetection {
  catalogEntryId: string;
  risk: Exclude<RiskLevel, "none">;
  obligations: ObligationId[];
  notes?: string;
}

export interface ServiceProfileHint {
  primaryDomain:
    | "general"
    | "credit_finance"
    | "employment"
    | "healthcare"
    | "education"
    | "biometric_id"
    | "law_enforcement"
    | "public_service"
    | "research_internal";
  decisionAutomation:
    | "none"
    | "advisory"
    | "human_in_loop"
    | "fully_automated";
  customerExposure: boolean;
  dataKinds: Array<
    "none" | "pii" | "financial" | "health" | "biometric" | "behavioral"
  >;
}

export interface ExpectedOutcome {
  overallRisk: RiskLevel;
  postureAssessment: CompliancePosture;
  applicableObligations: ObligationId[];
  conditionalObligations: ObligationId[];
  notApplicableObligations: ObligationId[];
  criticalObligations: ObligationId[];
  serviceProfileHints: ServiceProfileHint;
  expectedSystems?: ExpectedSystemDetection[];
  mustMention: string[];
  shouldRecommend: string[];
  shouldQuestion: string[];
  mustNotClaim: string[];
}

export interface BenchmarkScenario {
  id: string;
  mode: ScenarioMode;
  title: string;
  serviceCategory: string;
  posture: CompliancePosture;
  summary: string;
  benchmarkTags: string[];
  input: {
    companyProfile?: CompanyProfileInput;
    repositoryBlueprint?: RepoBlueprintInput;
  };
  expected: ExpectedOutcome;
}

export interface BenchmarkDataset {
  version: string;
  alignedTo: string;
  generatedAt: string;
  scenarioCount: number;
  notes: string[];
  scoringGuide: {
    profileMode: Array<{
      id: string;
      label: string;
      weight: number;
      rule: string;
    }>;
    scanMode: Array<{
      id: string;
      label: string;
      weight: number;
      rule: string;
    }>;
    failureConditions: string[];
  };
  scenarios: BenchmarkScenario[];
}

const ALL_OBLIGATIONS: ObligationId[] = [
  "AIBA-NOTICE",
  "AIBA-WATERMARK",
  "AIBA-HIGH-IMPACT",
  "AIBA-FOREIGN-REP",
  "AIBA-RISK-MGMT",
  "AIBA-DATA-GOVERNANCE",
  "AIBA-HIGH-COMPUTE",
  "AIBA-PUBLIC-DISCLOSURE",
  "AIBA-IMPACT-ASSESSMENT",
];

const NOTICE = "AIBA-NOTICE";
const WATERMARK = "AIBA-WATERMARK";
const HIGH_IMPACT = "AIBA-HIGH-IMPACT";
const FOREIGN_REP = "AIBA-FOREIGN-REP";
const RISK_MGMT = "AIBA-RISK-MGMT";
const DATA_GOV = "AIBA-DATA-GOVERNANCE";
const HIGH_COMPUTE = "AIBA-HIGH-COMPUTE";
const PUBLIC_DISCLOSURE = "AIBA-PUBLIC-DISCLOSURE";
const IMPACT = "AIBA-IMPACT-ASSESSMENT";

function uniq<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function remainingObligations(
  applicable: readonly ObligationId[],
  conditional: readonly ObligationId[] = []
): ObligationId[] {
  const taken = new Set([...applicable, ...conditional]);
  return ALL_OBLIGATIONS.filter((id) => !taken.has(id));
}

function outcome(input: {
  overallRisk: RiskLevel;
  postureAssessment: CompliancePosture;
  applicableObligations: ObligationId[];
  conditionalObligations?: ObligationId[];
  criticalObligations?: ObligationId[];
  serviceProfileHints: ServiceProfileHint;
  expectedSystems?: ExpectedSystemDetection[];
  mustMention: string[];
  shouldRecommend: string[];
  shouldQuestion?: string[];
  mustNotClaim?: string[];
}): ExpectedOutcome {
  const conditionalObligations = input.conditionalObligations ?? [];
  return {
    overallRisk: input.overallRisk,
    postureAssessment: input.postureAssessment,
    applicableObligations: uniq(input.applicableObligations),
    conditionalObligations: uniq(conditionalObligations),
    notApplicableObligations: remainingObligations(
      input.applicableObligations,
      conditionalObligations
    ),
    criticalObligations: uniq(
      input.criticalObligations ?? input.applicableObligations
    ),
    serviceProfileHints: input.serviceProfileHints,
    expectedSystems: input.expectedSystems,
    mustMention: input.mustMention,
    shouldRecommend: input.shouldRecommend,
    shouldQuestion: input.shouldQuestion ?? [],
    mustNotClaim: input.mustNotClaim ?? [],
  };
}

const scenarios: BenchmarkScenario[] = [
  {
    id: "profile-001",
    mode: "company_profile",
    title: "대출 승인 자동화 + OpenAI 민원 챗봇",
    serviceCategory: "핀테크 / 대출심사",
    posture: "poor",
    summary:
      "자체 신용평가 모델이 승인/거절을 자동 결정하고, 별도 OpenAI 챗봇이 대출 사유를 설명한다. 위험관리 문서와 이용자 고지가 없다.",
    benchmarkTags: [
      "high_impact",
      "foreign_model",
      "auto_decision",
      "poor_notice",
    ],
    input: {
      companyProfile: {
        name: "퀵론랩",
        industry: "핀테크 대출중개",
        employeeCount: 140,
        annualRevenueKRW: 32_000_000_000,
        aiUsages: ["auto_decision", "chatbot", "generative_text"],
        usesForeignAI: true,
        notes:
          "신용점수, 부채비율, 소득내역을 바탕으로 자체 승인 모델이 자동 거절 여부를 산출합니다. 거절 사유 안내는 OpenAI API로 생성하며, 고객 화면의 AI 고지는 아직 없습니다. 모델 학습 데이터 출처 문서도 정리되지 않았습니다.",
      },
    },
    expected: outcome({
      overallRisk: "high",
      postureAssessment: "poor",
      applicableObligations: [
        RISK_MGMT,
        NOTICE,
        FOREIGN_REP,
        HIGH_IMPACT,
        IMPACT,
        PUBLIC_DISCLOSURE,
        DATA_GOV,
      ],
      criticalObligations: [
        HIGH_IMPACT,
        IMPACT,
        PUBLIC_DISCLOSURE,
        NOTICE,
      ],
      serviceProfileHints: {
        primaryDomain: "credit_finance",
        decisionAutomation: "fully_automated",
        customerExposure: true,
        dataKinds: ["financial", "pii", "behavioral"],
      },
      mustMention: [
        "대출 승인/거절 자동결정",
        "해외 LLM 직접 호출",
        "신용·소득 데이터 처리",
      ],
      shouldRecommend: [
        "승인/거절 화면에 AI 사용 고지를 추가",
        "영향평가와 위험관리체계를 문서화",
        "학습 데이터 출처 및 적법성 기록을 정비",
      ],
      shouldQuestion: [
        "거절 결과에 사람이 개입하는지",
        "국내대리인 지정 요건을 실제로 충족하는지",
      ],
      mustNotClaim: [WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-002",
    mode: "company_profile",
    title: "HyperCLOVA X 기반 고객지원 센터",
    serviceCategory: "SaaS / 고객지원",
    posture: "good",
    summary:
      "국내 LLM으로 FAQ 응답을 생성하지만 상담원 연결 전 단계에서만 사용된다. AI 안내 문구, 대화 로그 보존 정책, 운영 점검표가 이미 있다.",
    benchmarkTags: ["korean_llm", "good_controls", "chatbot"],
    input: {
      companyProfile: {
        name: "서포트허브",
        industry: "B2B SaaS",
        employeeCount: 55,
        annualRevenueKRW: 8_400_000_000,
        aiUsages: ["chatbot", "generative_text"],
        usesForeignAI: false,
        notes:
          "네이버 HyperCLOVA X로 1차 FAQ 응답을 생성합니다. 모든 채팅창 상단에 AI 응답 안내가 있고, 미확신 답변은 상담원에게 이관됩니다. 위험관리 책임자와 월간 점검표가 있으며 해외 모델은 사용하지 않습니다.",
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "good",
      applicableObligations: [RISK_MGMT, NOTICE],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "human_in_loop",
        customerExposure: true,
        dataKinds: ["behavioral"],
      },
      mustMention: [
        "국내 모델 사용으로 해외 대리인 이슈가 낮음",
        "상담원 이관 절차",
        "기존 고지/운영 통제 존재",
      ],
      shouldRecommend: [
        "기존 점검표를 시행일 기준 의무 매핑 표로 확장",
        "고지 문구와 이관 기준을 정기 점검",
      ],
      shouldQuestion: ["상담 로그에 개인정보가 저장되는 범위"],
      mustNotClaim: [FOREIGN_REP, HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-003",
    mode: "company_profile",
    title: "이력서 자동 선별 + 해외 생성형 설명기",
    serviceCategory: "HR / 채용 자동화",
    posture: "poor",
    summary:
      "지원자 이력서를 자동 채점해 서류 통과 여부를 정하고, 결과 통지 문구를 해외 생성형 모델이 작성한다. 지원자 대상 고지와 영향평가가 없다.",
    benchmarkTags: ["employment", "foreign_model", "auto_decision"],
    input: {
      companyProfile: {
        name: "하이어펄스",
        industry: "채용 SaaS",
        employeeCount: 90,
        annualRevenueKRW: 11_000_000_000,
        aiUsages: ["auto_decision", "generative_text"],
        usesForeignAI: true,
        notes:
          "지원자 점수는 자동으로 계산되고 70점 미만은 즉시 탈락 처리됩니다. 탈락 사유 메일 초안은 Anthropic API가 생성합니다. 공고나 지원 화면에 AI 사용 고지는 없고, 차별 영향 검토도 아직 하지 않았습니다.",
      },
    },
    expected: outcome({
      overallRisk: "high",
      postureAssessment: "poor",
      applicableObligations: [
        RISK_MGMT,
        NOTICE,
        FOREIGN_REP,
        HIGH_IMPACT,
        IMPACT,
        PUBLIC_DISCLOSURE,
      ],
      criticalObligations: [HIGH_IMPACT, IMPACT, NOTICE],
      serviceProfileHints: {
        primaryDomain: "employment",
        decisionAutomation: "fully_automated",
        customerExposure: true,
        dataKinds: ["pii", "behavioral"],
      },
      mustMention: [
        "지원자 선별 자동결정",
        "지원자 권리/차별 리스크",
        "해외 생성형 모델 사용",
      ],
      shouldRecommend: [
        "지원 단계부터 AI 평가 사실을 고지",
        "지원자 영향평가와 재심 절차를 마련",
        "자동 탈락 기준에 사람 검토 단계를 추가",
      ],
      shouldQuestion: [
        "지원자 이의제기 절차가 있는지",
        "탈락 판단을 사람이 뒤집을 수 있는지",
      ],
      mustNotClaim: [WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-004",
    mode: "company_profile",
    title: "영상의학 판독 보조 + 로컬 파인튜닝",
    serviceCategory: "헬스케어 / 의료보조",
    posture: "mixed",
    summary:
      "의사용 판독 요약과 우선순위 추천에 AI를 사용한다. 의사 최종 승인 절차는 있지만, 학습 데이터 거버넌스와 정기 영향평가 체계는 덜 성숙하다.",
    benchmarkTags: ["healthcare", "fine_tuning", "human_in_loop"],
    input: {
      companyProfile: {
        name: "라디옵스",
        industry: "의료 AI",
        employeeCount: 210,
        annualRevenueKRW: 41_000_000_000,
        aiUsages: ["medical", "generative_text"],
        usesForeignAI: false,
        notes:
          "흉부 CT 소견 초안을 생성하고 중증 우선순위를 추천합니다. 최종 판독은 의사가 승인하지만, 내부적으로 오픈소스 모델을 로컬 파인튜닝해 사용합니다. 환자 데이터 사용 동의와 품질 검토는 있으나 편향 검토 기록은 부분적입니다.",
      },
    },
    expected: outcome({
      overallRisk: "high",
      postureAssessment: "mixed",
      applicableObligations: [
        RISK_MGMT,
        NOTICE,
        HIGH_IMPACT,
        IMPACT,
        PUBLIC_DISCLOSURE,
        DATA_GOV,
      ],
      serviceProfileHints: {
        primaryDomain: "healthcare",
        decisionAutomation: "human_in_loop",
        customerExposure: false,
        dataKinds: ["health", "pii"],
      },
      mustMention: [
        "의료 도메인",
        "의사 승인 절차",
        "파인튜닝 데이터 거버넌스",
      ],
      shouldRecommend: [
        "학습 데이터 출처·동의·편향 검토를 문서화",
        "의사 승인 로그와 우선순위 추천 정확도를 정기 평가",
        "고영향 AI 영향평가 갱신 주기를 정의",
      ],
      shouldQuestion: ["응급 우선순위가 자동 반영되는 범위"],
      mustNotClaim: [FOREIGN_REP, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-005",
    mode: "company_profile",
    title: "이커머스 추천 엔진",
    serviceCategory: "리테일 / 추천",
    posture: "good",
    summary:
      "상품 추천 랭킹에 자체 모델을 사용한다. 구매 여부를 직접 자동결정하지는 않으며, 추천 고지와 내부 점검 프로세스가 준비돼 있다.",
    benchmarkTags: ["recommendation", "low_risk", "good_controls"],
    input: {
      companyProfile: {
        name: "커머스웨이브",
        industry: "이커머스",
        employeeCount: 300,
        annualRevenueKRW: 88_000_000_000,
        aiUsages: ["recommendation"],
        usesForeignAI: false,
        notes:
          "구매 이력과 클릭 데이터를 바탕으로 상품 추천 순서를 조정합니다. 추천 영역 하단에 개인화 추천 고지가 있고, 분기별 성능 점검과 사용자 불만 모니터링을 운영합니다.",
      },
    },
    expected: outcome({
      overallRisk: "low",
      postureAssessment: "good",
      applicableObligations: [RISK_MGMT, NOTICE],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "advisory",
        customerExposure: true,
        dataKinds: ["behavioral"],
      },
      mustMention: [
        "추천 엔진은 자동 승인/거절과 다름",
        "기존 고지와 모니터링 체계",
      ],
      shouldRecommend: [
        "추천 설명 문구와 거부 옵션을 점검",
        "분기 점검 결과를 위험관리 문서에 통합",
      ],
      shouldQuestion: ["민감정보 기반 세그먼트가 포함되는지"],
      mustNotClaim: [HIGH_IMPACT, FOREIGN_REP, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-006",
    mode: "company_profile",
    title: "얼굴인식 출입·근태 시스템",
    serviceCategory: "보안 / 생체인식",
    posture: "poor",
    summary:
      "외부 얼굴인식 엔진으로 출입 허용과 근태 기록을 처리한다. 생체정보 보호와 이용자 고지가 미흡하고 국내대리인 검토도 없다.",
    benchmarkTags: ["biometric", "foreign_vendor", "poor_controls"],
    input: {
      companyProfile: {
        name: "게이트센트리",
        industry: "오피스 보안",
        employeeCount: 45,
        annualRevenueKRW: 5_600_000_000,
        aiUsages: ["biometric", "auto_decision"],
        usesForeignAI: true,
        notes:
          "외부 얼굴인식 API가 출입 허용 여부를 자동 판정하고 근태 이벤트를 기록합니다. 직원 대상 설명 문구는 설치 안내문 정도에 그치고, 별도 영향평가와 오탐 대응 절차는 없습니다.",
      },
    },
    expected: outcome({
      overallRisk: "high",
      postureAssessment: "poor",
      applicableObligations: [
        RISK_MGMT,
        NOTICE,
        FOREIGN_REP,
        HIGH_IMPACT,
        IMPACT,
        PUBLIC_DISCLOSURE,
      ],
      serviceProfileHints: {
        primaryDomain: "biometric_id",
        decisionAutomation: "fully_automated",
        customerExposure: true,
        dataKinds: ["biometric", "pii"],
      },
      mustMention: [
        "생체인식 기반 자동판정",
        "직원/출입자 고지 부족",
        "오탐 및 권리침해 리스크",
      ],
      shouldRecommend: [
        "출입자 대상 AI·생체처리 고지를 강화",
        "오탐/오거절 대응 절차와 관리자 승인 예외를 마련",
        "생체정보 영향평가와 보관 정책을 정비",
      ],
      shouldQuestion: ["생체정보 저장 위치와 보관기간"],
      mustNotClaim: [WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-007",
    mode: "company_profile",
    title: "광고 이미지 생성 스튜디오",
    serviceCategory: "마케팅 / 생성형 이미지",
    posture: "poor",
    summary:
      "광고용 배너와 인플루언서 이미지를 생성하지만 워터마크 정책이 없다. 결과물 표기와 고객 약관 정비가 필요한 상태다.",
    benchmarkTags: ["generative_image", "watermark", "poor_controls"],
    input: {
      companyProfile: {
        name: "픽셀포지",
        industry: "광고 제작 SaaS",
        employeeCount: 28,
        annualRevenueKRW: 3_200_000_000,
        aiUsages: ["generative_image", "generative_text"],
        usesForeignAI: true,
        notes:
          "광고 문구와 이미지 시안을 모두 외부 생성형 API로 만듭니다. 결과물에 AI 생성 표시나 워터마크는 넣지 않고 있으며, 실존 인물과 유사한 캐릭터 생성도 허용하고 있습니다.",
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "poor",
      applicableObligations: [RISK_MGMT, NOTICE, FOREIGN_REP, WATERMARK],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "advisory",
        customerExposure: true,
        dataKinds: ["behavioral"],
      },
      mustMention: [
        "생성형 이미지 결과물 표시",
        "실존 인물 유사 이미지 리스크",
        "해외 생성형 모델 의존",
      ],
      shouldRecommend: [
        "이미지·문구 결과물에 AI 생성 표시를 추가",
        "실존 인물 유사 생성 금지 기준을 약관에 반영",
        "워크플로우별 워터마크 적용 여부를 점검",
      ],
      shouldQuestion: ["고객이 결과물을 어디에 재배포하는지"],
      mustNotClaim: [HIGH_IMPACT, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-008",
    mode: "company_profile",
    title: "사내 코드 어시스턴트 (Ollama)",
    serviceCategory: "엔지니어링 생산성 / 내부도구",
    posture: "good",
    summary:
      "사내 개발자 전용 코드 보조도구로 로컬 LLM을 사용한다. 외부 고객 노출은 없지만 프롬프트 로그와 보안 통제는 계속 관리해야 한다.",
    benchmarkTags: ["internal_tool", "local_llm", "good_controls"],
    input: {
      companyProfile: {
        name: "데브메이슨",
        industry: "소프트웨어 개발",
        employeeCount: 420,
        annualRevenueKRW: 120_000_000_000,
        aiUsages: ["generative_text"],
        usesForeignAI: false,
        notes:
          "Ollama 기반 사내 코드 어시스턴트를 VPN 내부에서만 운영합니다. 출력은 개발자 참고용이며 자동 배포와 연결되지 않습니다. 프롬프트 로그는 30일 보관하고, 보안팀이 월별 검토를 수행합니다.",
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "good",
      applicableObligations: [RISK_MGMT, NOTICE],
      serviceProfileHints: {
        primaryDomain: "research_internal",
        decisionAutomation: "advisory",
        customerExposure: false,
        dataKinds: ["none"],
      },
      mustMention: [
        "사내 전용 도구",
        "자동 배포와 분리된 참고용 사용",
        "기존 보안 통제",
      ],
      shouldRecommend: [
        "사내 안내문과 로그 보존 정책을 시행일 기준으로 정리",
        "소스코드·비밀정보 입력 가이드를 갱신",
      ],
      shouldQuestion: ["개발자가 고객 데이터 샘플을 붙여넣는지"],
      mustNotClaim: [FOREIGN_REP, HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-009",
    mode: "company_profile",
    title: "에세이 피드백 + 초안 성적 추천",
    serviceCategory: "에듀테크 / 학습평가",
    posture: "mixed",
    summary:
      "학생 글에 서술형 피드백을 주고 교사에게 점수 초안을 추천한다. 교사 승인 절차는 있으나 학생 안내와 데이터 보존 정책은 더 정교해져야 한다.",
    benchmarkTags: ["education", "recommendation", "student_data"],
    input: {
      companyProfile: {
        name: "에듀라이트",
        industry: "에듀테크",
        employeeCount: 72,
        annualRevenueKRW: 7_900_000_000,
        aiUsages: ["generative_text", "recommendation"],
        usesForeignAI: true,
        notes:
          "학생 에세이에 피드백을 생성하고, 교사 화면에는 점수 초안을 제안합니다. 최종 성적은 교사가 확정하지만 학생과 학부모에게 AI 사용 사실을 별도로 고지하지는 않습니다. 교내 데이터 보존 기간도 학교별로 제각각입니다.",
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "mixed",
      applicableObligations: [RISK_MGMT, NOTICE, FOREIGN_REP],
      serviceProfileHints: {
        primaryDomain: "education",
        decisionAutomation: "human_in_loop",
        customerExposure: true,
        dataKinds: ["pii", "behavioral"],
      },
      mustMention: [
        "학생 데이터",
        "교사 최종 승인",
        "학생/학부모 대상 고지 필요성",
      ],
      shouldRecommend: [
        "학생·학부모 대상 AI 사용 고지 방식을 마련",
        "학교별 데이터 보존/삭제 정책을 표준화",
        "교사 승인 로그를 남겨 인간 통제를 입증",
      ],
      shouldQuestion: ["점수 초안이 실제 평가에 얼마나 강하게 반영되는지"],
      mustNotClaim: [HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-010",
    mode: "company_profile",
    title: "보험금 지급 거절 자동심사",
    serviceCategory: "인슈어테크 / 손해사정",
    posture: "poor",
    summary:
      "지급 거절 후보를 자동 선정하고 상담용 설명을 생성한다. 보험계약자 권리 침해 가능성이 높고 인간 재검토 흔적도 약하다.",
    benchmarkTags: ["financial", "auto_decision", "poor_controls"],
    input: {
      companyProfile: {
        name: "클레임패스",
        industry: "보험 자동심사",
        employeeCount: 160,
        annualRevenueKRW: 26_000_000_000,
        aiUsages: ["auto_decision", "chatbot", "generative_text"],
        usesForeignAI: true,
        notes:
          "LightGBM 기반 부정청구 탐지 점수가 일정 기준을 넘으면 지급 거절 대기열로 자동 이동합니다. 고객센터 상담 스크립트는 외부 LLM이 작성합니다. 계약자 대상 고지와 거절 재심 프로세스는 아직 수동 메일 수준입니다.",
      },
    },
    expected: outcome({
      overallRisk: "high",
      postureAssessment: "poor",
      applicableObligations: [
        RISK_MGMT,
        NOTICE,
        FOREIGN_REP,
        HIGH_IMPACT,
        IMPACT,
        PUBLIC_DISCLOSURE,
        DATA_GOV,
      ],
      serviceProfileHints: {
        primaryDomain: "credit_finance",
        decisionAutomation: "fully_automated",
        customerExposure: true,
        dataKinds: ["financial", "pii", "behavioral"],
      },
      mustMention: [
        "보험금 지급 거절 자동화",
        "계약자 권리구제",
        "모델 재학습 및 데이터 거버넌스",
      ],
      shouldRecommend: [
        "자동 거절 전 인간 검토를 필수화",
        "재심 절차와 고지 문구를 표준화",
        "학습 데이터 출처·편향 검토를 문서화",
      ],
      shouldQuestion: ["점수 임계치와 오탐률이 어떻게 관리되는지"],
      mustNotClaim: [WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-011",
    mode: "company_profile",
    title: "계약서 요약 어시스턴트 (Upstage Solar)",
    serviceCategory: "리걸테크 / 문서보조",
    posture: "good",
    summary:
      "법무팀 내부 검토용으로 계약서 요약을 생성한다. 사람 승인과 입력 정책이 있고 국내 모델을 사용한다.",
    benchmarkTags: ["legaltech", "korean_llm", "internal_assist"],
    input: {
      companyProfile: {
        name: "로클루",
        industry: "리걸테크",
        employeeCount: 38,
        annualRevenueKRW: 4_500_000_000,
        aiUsages: ["generative_text"],
        usesForeignAI: false,
        notes:
          "Upstage Solar 기반 계약서 요약을 사내 법무팀만 사용합니다. 결과는 참고용이며 변호사가 최종 수정합니다. 입력 가능 문서 종류와 비밀정보 취급 지침이 이미 마련돼 있습니다.",
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "good",
      applicableObligations: [RISK_MGMT, NOTICE],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "advisory",
        customerExposure: false,
        dataKinds: ["behavioral"],
      },
      mustMention: [
        "사내 법무팀 내부 사용",
        "국내 모델 사용",
        "사람 최종 수정 절차",
      ],
      shouldRecommend: [
        "사내 안내와 로그 관리 기준을 시행일 기준으로 묶기",
        "입력 문서 분류 정책을 정기 점검",
      ],
      shouldQuestion: ["외부 고객 문서가 직접 업로드되는지"],
      mustNotClaim: [FOREIGN_REP, HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-012",
    mode: "company_profile",
    title: "민원 분류·우선순위 추천",
    serviceCategory: "공공서비스 / 민원처리",
    posture: "mixed",
    summary:
      "민원 내용을 요약하고 담당 부서와 긴급도를 추천한다. 실제 처분은 사람이 하지만 공공서비스 맥락이라 설명가능성과 기록성이 중요하다.",
    benchmarkTags: ["public_service", "recommendation", "mixed_controls"],
    input: {
      companyProfile: {
        name: "시빅루프",
        industry: "공공 IT",
        employeeCount: 130,
        annualRevenueKRW: 18_000_000_000,
        aiUsages: ["chatbot", "recommendation", "generative_text"],
        usesForeignAI: false,
        notes:
          "민원 내용 요약과 담당 부서 추천, 긴급도 추천을 제공합니다. 실제 민원 종결 여부는 공무원이 결정합니다. 민원인 고지는 콜센터 스크립트에만 있고, 웹 민원 양식에는 반영되지 않았습니다.",
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "mixed",
      applicableObligations: [RISK_MGMT, NOTICE],
      serviceProfileHints: {
        primaryDomain: "public_service",
        decisionAutomation: "human_in_loop",
        customerExposure: true,
        dataKinds: ["pii", "behavioral"],
      },
      mustMention: [
        "민원인 데이터",
        "공무원 최종 판단",
        "웹 채널 고지 누락",
      ],
      shouldRecommend: [
        "웹 민원 접수 단계에도 AI 고지를 추가",
        "추천 기록과 사람 판단 차이를 로그로 남기기",
      ],
      shouldQuestion: ["추천이 실제 처리순서에 자동 반영되는지"],
      mustNotClaim: [FOREIGN_REP, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-013",
    mode: "company_profile",
    title: "원격진료 증상체크 챗봇",
    serviceCategory: "디지털 헬스 / 증상분류",
    posture: "poor",
    summary:
      "환자 증상을 받아 외부 생성형 모델이 응급도와 진료과를 추천한다. 환자 대상 고지, 영향평가, 해외 모델 사용 관리가 부족하다.",
    benchmarkTags: ["medical", "foreign_model", "public_chatbot"],
    input: {
      companyProfile: {
        name: "메디플로우",
        industry: "원격진료",
        employeeCount: 84,
        annualRevenueKRW: 15_500_000_000,
        aiUsages: ["medical", "chatbot", "generative_text"],
        usesForeignAI: true,
        notes:
          "환자가 입력한 증상과 복용약 정보를 바탕으로 외부 LLM이 응급도와 진료과를 추천합니다. 의료진 확인 없이 예약 단계가 이어질 수 있고, 환자 화면의 AI 고지와 영향평가 문서는 아직 없습니다. 일부 환자 데이터를 파인튜닝 실험에 사용했습니다.",
      },
    },
    expected: outcome({
      overallRisk: "high",
      postureAssessment: "poor",
      applicableObligations: [
        RISK_MGMT,
        NOTICE,
        FOREIGN_REP,
        HIGH_IMPACT,
        IMPACT,
        PUBLIC_DISCLOSURE,
        DATA_GOV,
      ],
      criticalObligations: [HIGH_IMPACT, IMPACT, DATA_GOV],
      serviceProfileHints: {
        primaryDomain: "healthcare",
        decisionAutomation: "fully_automated",
        customerExposure: true,
        dataKinds: ["health", "pii"],
      },
      mustMention: [
        "환자 증상 기반 추천",
        "외부 생성형 모델",
        "환자 데이터 파인튜닝",
      ],
      shouldRecommend: [
        "의료진 승인 없이 예약 흐름이 이어지지 않게 통제",
        "환자 고지와 영향평가를 즉시 문서화",
        "학습 데이터 사용 동의와 편향 검토를 정리",
      ],
      shouldQuestion: ["응급도 추천이 자동 예약 우선순위에 반영되는지"],
      mustNotClaim: [WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-014",
    mode: "company_profile",
    title: "제조 결함 탐지 보조 대시보드",
    serviceCategory: "제조 / 비전보조",
    posture: "good",
    summary:
      "비전 모델이 결함 후보를 표시하지만 출하 승인 자체를 자동 결정하지는 않는다. 현장 품질관리자가 최종 판정한다.",
    benchmarkTags: ["vision", "human_review", "good_controls"],
    input: {
      companyProfile: {
        name: "팩토리아이",
        industry: "스마트팩토리",
        employeeCount: 260,
        annualRevenueKRW: 61_000_000_000,
        aiUsages: ["recommendation"],
        usesForeignAI: false,
        notes:
          "결함 의심 이미지에 박스를 표시하고 품질관리자가 최종 불량 여부를 결정합니다. 현장 작업자 교육 자료와 운영 점검표가 있으며, 모델 출력만으로 출하가 차단되지는 않습니다.",
      },
    },
    expected: outcome({
      overallRisk: "low",
      postureAssessment: "good",
      applicableObligations: [RISK_MGMT, NOTICE],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "human_in_loop",
        customerExposure: false,
        dataKinds: ["none"],
      },
      mustMention: [
        "품질관리자 최종 판정",
        "현장 운영 점검표",
        "자동 출하 차단과 분리",
      ],
      shouldRecommend: [
        "점검표와 오탐률 추세를 위험관리 기록으로 연결",
        "작업자 안내 문구를 최신화",
      ],
      shouldQuestion: ["결함 탐지 결과가 작업자 평가에 재사용되는지"],
      mustNotClaim: [HIGH_IMPACT, FOREIGN_REP, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "profile-015",
    mode: "company_profile",
    title: "합성 인플루언서 광고 제작 플랫폼",
    serviceCategory: "콘텐츠 제작 / 생성형 미디어",
    posture: "mixed",
    summary:
      "가상 인플루언서 이미지와 카피를 생성한다. 워터마크와 표시는 일부 적용하지만 에이전시별 운영 기준이 일관되지는 않다.",
    benchmarkTags: ["generative_image", "watermark", "mixed_controls"],
    input: {
      companyProfile: {
        name: "미러뮤즈",
        industry: "광고대행",
        employeeCount: 64,
        annualRevenueKRW: 9_700_000_000,
        aiUsages: ["generative_image", "generative_text"],
        usesForeignAI: false,
        notes:
          "가상 인플루언서 컷과 브랜드 카피를 생성합니다. 일부 캠페인에는 AI 생성 표기를 붙이지만, 협력 에이전시가 직접 내려받아 쓰는 자산에는 누락이 있습니다. 운영팀이 매뉴얼을 만들었으나 강제 검수는 부족합니다.",
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "mixed",
      applicableObligations: [RISK_MGMT, NOTICE, WATERMARK],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "advisory",
        customerExposure: true,
        dataKinds: ["behavioral"],
      },
      mustMention: [
        "가상 인물/합성 콘텐츠",
        "표시 누락이 발생하는 유통 경로",
        "운영 매뉴얼은 있으나 강제력이 약함",
      ],
      shouldRecommend: [
        "다운로드 자산에도 AI 생성 표시가 남도록 강제",
        "에이전시 전달 전 검수 절차를 추가",
      ],
      shouldQuestion: ["표시 누락 시 책임 주체가 누구인지"],
      mustNotClaim: [FOREIGN_REP, HIGH_IMPACT, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-001",
    mode: "scan_blueprint",
    title: "대출심사 Python 서비스",
    serviceCategory: "핀테크 / 코드 스캔",
    posture: "poor",
    summary:
      "신용평가 sklearn 모델과 OpenAI 설명 생성이 함께 존재하는 저장소. 도메인 키워드와 임계치 결정 패턴이 명확하다.",
    benchmarkTags: ["scan", "high_impact", "multi_system", "foreign_model"],
    input: {
      repositoryBlueprint: {
        repoName: "loan-underwriter",
        repoStory:
          "대출 승인 점수를 계산하고 고객에게 거절 사유를 설명하는 Python 백엔드",
        languages: ["python"],
        manifestDeps: ["scikit-learn", "openai", "pandas"],
        sourceSignals: [
          {
            path: "app/underwrite.py",
            summary:
              "from sklearn.linear_model import LogisticRegression / approve = probability > 0.82 / credit_score, debt_ratio, loan_amount, ssn 컬럼 사용",
          },
          {
            path: "app/chat.py",
            summary:
              "from openai import OpenAI / client.responses.create(model='gpt-4o-mini') / rejection_reason 생성",
          },
          {
            path: "data/train.py",
            summary:
              "pd.read_csv('loan_training.csv') / model.fit(X, y)",
          },
        ],
        uiSignals: ["고객 웹 화면 또는 README에 AI 사용 고지 문구 없음"],
        complianceSignals: [
          "영향평가 문서 없음",
          "학습데이터 출처 문서 없음",
        ],
      },
    },
    expected: outcome({
      overallRisk: "high",
      postureAssessment: "poor",
      applicableObligations: [
        RISK_MGMT,
        NOTICE,
        FOREIGN_REP,
        HIGH_IMPACT,
        IMPACT,
        PUBLIC_DISCLOSURE,
        DATA_GOV,
      ],
      serviceProfileHints: {
        primaryDomain: "credit_finance",
        decisionAutomation: "fully_automated",
        customerExposure: true,
        dataKinds: ["financial", "pii", "behavioral"],
      },
      expectedSystems: [
        {
          catalogEntryId: "py.sklearn",
          risk: "high",
          obligations: [
            RISK_MGMT,
            DATA_GOV,
            HIGH_IMPACT,
            IMPACT,
            PUBLIC_DISCLOSURE,
          ],
          notes: "대출 승인 자동판정 엔진",
        },
        {
          catalogEntryId: "py.openai",
          risk: "medium",
          obligations: [RISK_MGMT, NOTICE, FOREIGN_REP],
          notes: "거절 사유 설명용 생성형 모델",
        },
      ],
      mustMention: [
        "신용/대출 키워드",
        "임계치 기반 승인 로직",
        "OpenAI 설명 생성과 본심사 모델은 별도 시스템",
      ],
      shouldRecommend: [
        "시스템별로 의무를 분리해 보고",
        "고객 고지와 재심 절차를 추가",
        "학습데이터 거버넌스를 문서화",
      ],
      shouldQuestion: ["거절 설명이 자동 발송되는지"],
      mustNotClaim: [WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-002",
    mode: "scan_blueprint",
    title: "OpenAI 고객지원 챗봇 (고지 있음)",
    serviceCategory: "SaaS / 코드 스캔",
    posture: "good",
    summary:
      "TypeScript 챗봇 저장소로, UI에 AI 안내 문구가 명시돼 있다. 외부 노출은 있지만 고영향 도메인은 아니다.",
    benchmarkTags: ["scan", "openai", "good_notice"],
    input: {
      repositoryBlueprint: {
        repoName: "support-bot-web",
        repoStory: "고객지원 채팅 위젯과 API 라우트가 있는 Next.js 앱",
        languages: ["typescript"],
        manifestDeps: ["openai", "next", "react"],
        sourceSignals: [
          {
            path: "src/app/api/chat/route.ts",
            summary:
              "import OpenAI from 'openai' / client.responses.create({ model: 'gpt-4o-mini' })",
          },
        ],
        uiSignals: [
          "src/app/chat/page.tsx 에 '이 채팅은 AI가 생성한 초안이며 상담원 검토 전 단계입니다.' 문구가 있음",
        ],
        complianceSignals: ["FAQ 봇 운영 점검표 있음"],
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "good",
      applicableObligations: [RISK_MGMT, NOTICE, FOREIGN_REP],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "human_in_loop",
        customerExposure: true,
        dataKinds: ["behavioral"],
      },
      expectedSystems: [
        {
          catalogEntryId: "ts.openai",
          risk: "medium",
          obligations: [RISK_MGMT, NOTICE, FOREIGN_REP],
        },
      ],
      mustMention: [
        "사용자 대상 생성형 응답",
        "UI 고지 문구 존재",
        "상담원 검토 또는 이관 구조",
      ],
      shouldRecommend: [
        "고지 문구와 운영 점검표를 연결해 보관",
        "FAQ 봇 오류 대응 절차를 문서화",
      ],
      shouldQuestion: ["개인정보가 프롬프트로 전송되는지"],
      mustNotClaim: [HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-003",
    mode: "scan_blueprint",
    title: "Diffusers 이미지 생성기 (워터마크 없음)",
    serviceCategory: "크리에이티브 툴 / 코드 스캔",
    posture: "poor",
    summary:
      "DiffusionPipeline을 이용한 이미지 생성 앱이며, 워터마크나 메타데이터 처리 흔적이 없다.",
    benchmarkTags: ["scan", "image_generation", "watermark_missing"],
    input: {
      repositoryBlueprint: {
        repoName: "studio-diffusion",
        repoStory: "캠페인 이미지를 만드는 Python 이미지 생성 서비스",
        languages: ["python"],
        manifestDeps: ["diffusers", "transformers", "torch"],
        sourceSignals: [
          {
            path: "generate.py",
            summary:
              "from diffusers import DiffusionPipeline / pipe = DiffusionPipeline.from_pretrained(...) / image = pipe(prompt).images[0]",
          },
        ],
        uiSignals: ["다운로드 버튼만 있고 AI 생성 표기나 워터마크 안내 없음"],
        complianceSignals: ["watermark, c2pa, exif 관련 코드 없음"],
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "poor",
      applicableObligations: [RISK_MGMT, NOTICE, WATERMARK],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "advisory",
        customerExposure: true,
        dataKinds: ["behavioral"],
      },
      expectedSystems: [
        {
          catalogEntryId: "py.diffusers",
          risk: "medium",
          obligations: [RISK_MGMT, NOTICE, WATERMARK],
        },
      ],
      mustMention: [
        "이미지 생성 호출",
        "워터마크/메타데이터 처리 부재",
      ],
      shouldRecommend: [
        "다운로드 산출물에 생성 표시를 남기기",
        "워터마크 또는 메타데이터 삽입 로직 추가",
      ],
      shouldQuestion: ["실존 인물 유사 이미지 생성 여부"],
      mustNotClaim: [FOREIGN_REP, HIGH_IMPACT, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-004",
    mode: "scan_blueprint",
    title: "Diffusers 이미지 생성기 (워터마크 적용)",
    serviceCategory: "크리에이티브 툴 / 코드 스캔",
    posture: "good",
    summary:
      "이미지 생성 저장소지만 메타데이터 삽입과 다운로드 안내가 명확하다. 동일한 의무는 적용되더라도 리포트 톤은 덜 공격적이어야 한다.",
    benchmarkTags: ["scan", "image_generation", "good_controls"],
    input: {
      repositoryBlueprint: {
        repoName: "studio-diffusion-watermarked",
        repoStory: "워터마크가 있는 배너 생성 서비스",
        languages: ["python"],
        manifestDeps: ["diffusers", "piexif"],
        sourceSignals: [
          {
            path: "generate.py",
            summary:
              "DiffusionPipeline 사용 / sign_image(output) 호출 / exif metadata에 ai_generated=true 저장",
          },
        ],
        uiSignals: ["다운로드 전 'AI 생성 이미지' 배지 표시"],
        complianceSignals: ["watermark 및 metadata 코드 존재"],
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "good",
      applicableObligations: [RISK_MGMT, NOTICE, WATERMARK],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "advisory",
        customerExposure: true,
        dataKinds: ["behavioral"],
      },
      expectedSystems: [
        {
          catalogEntryId: "py.diffusers",
          risk: "medium",
          obligations: [RISK_MGMT, NOTICE, WATERMARK],
        },
      ],
      mustMention: [
        "워터마크 의무는 적용되지만 이미 일부 통제가 존재",
        "다운로드 안내와 메타데이터 처리",
      ],
      shouldRecommend: [
        "현재 워터마크 적용 범위를 정기 점검",
        "대행사 재배포 시 표시 유지 여부를 검증",
      ],
      shouldQuestion: ["원본 메타데이터가 편집 과정에서 사라지는지"],
      mustNotClaim: [FOREIGN_REP, HIGH_IMPACT, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-005",
    mode: "scan_blueprint",
    title: "XGBoost 지원자 선별 서비스",
    serviceCategory: "HR / 코드 스캔",
    posture: "poor",
    summary:
      "이력서 점수와 자동 탈락 임계치가 코드에 직접 드러난다. 지원자 대상 설명과 재검토 단계가 없다.",
    benchmarkTags: ["scan", "employment", "threshold_decision"],
    input: {
      repositoryBlueprint: {
        repoName: "resume-ranker",
        repoStory: "지원자 서류 통과 여부를 자동 점수화하는 Python API",
        languages: ["python"],
        manifestDeps: ["xgboost", "pandas"],
        sourceSignals: [
          {
            path: "rank.py",
            summary:
              "import xgboost as xgb / candidate_score 계산 / if probability > 0.75: reject_candidate() / resume, candidate_score, hire_decision 키워드",
          },
          {
            path: "train.py",
            summary: "pd.read_csv('candidate_training.csv') / xgb.train(...)",
          },
        ],
        uiSignals: ["지원자 포털에 AI 사용 고지 없음"],
        complianceSignals: ["영향평가 문서 없음"],
      },
    },
    expected: outcome({
      overallRisk: "high",
      postureAssessment: "poor",
      applicableObligations: [
        RISK_MGMT,
        NOTICE,
        HIGH_IMPACT,
        IMPACT,
        PUBLIC_DISCLOSURE,
        DATA_GOV,
      ],
      serviceProfileHints: {
        primaryDomain: "employment",
        decisionAutomation: "fully_automated",
        customerExposure: true,
        dataKinds: ["pii", "behavioral"],
      },
      expectedSystems: [
        {
          catalogEntryId: "py.xgboost",
          risk: "high",
          obligations: [
            RISK_MGMT,
            NOTICE,
            DATA_GOV,
            HIGH_IMPACT,
            IMPACT,
            PUBLIC_DISCLOSURE,
          ],
        },
      ],
      mustMention: [
        "지원자 평가/탈락 자동결정",
        "임계치 로직",
        "학습 데이터 거버넌스",
      ],
      shouldRecommend: [
        "지원자 고지와 이의제기 절차를 마련",
        "인간 검토 단계를 추가",
        "채용 영향평가를 수행",
      ],
      shouldQuestion: ["지원자 데이터 보관기간과 편향 검토 방식"],
      mustNotClaim: [FOREIGN_REP, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-006",
    mode: "scan_blueprint",
    title: "얼굴인식 출입 게이트",
    serviceCategory: "보안 / 코드 스캔",
    posture: "poor",
    summary:
      "face_recognition 기반 출입 승인 저장소다. 생체정보와 자동 출입 허용 로직이 결합돼 있다.",
    benchmarkTags: ["scan", "biometric", "high_impact"],
    input: {
      repositoryBlueprint: {
        repoName: "face-gate",
        repoStory: "사무실 출입문에서 얼굴 매칭으로 문을 여는 앱",
        languages: ["python"],
        manifestDeps: ["face_recognition"],
        sourceSignals: [
          {
            path: "gate.py",
            summary:
              "import face_recognition / if match_distance < 0.42: open_door() / employee_id, face_encoding 사용",
          },
        ],
        uiSignals: ["출입 단말에 AI/생체처리 고지 없음"],
        complianceSignals: ["오탐 대응 절차 없음"],
      },
    },
    expected: outcome({
      overallRisk: "high",
      postureAssessment: "poor",
      applicableObligations: [
        RISK_MGMT,
        NOTICE,
        HIGH_IMPACT,
        IMPACT,
        PUBLIC_DISCLOSURE,
      ],
      serviceProfileHints: {
        primaryDomain: "biometric_id",
        decisionAutomation: "fully_automated",
        customerExposure: true,
        dataKinds: ["biometric", "pii"],
      },
      expectedSystems: [
        {
          catalogEntryId: "py.face_recognition",
          risk: "high",
          obligations: [
            RISK_MGMT,
            NOTICE,
            HIGH_IMPACT,
            IMPACT,
            PUBLIC_DISCLOSURE,
          ],
        },
      ],
      mustMention: ["생체인식 자동판정", "오탐/오거절 위험"],
      shouldRecommend: [
        "출입 예외 승인 절차를 추가",
        "단말 고지와 관리자 로그를 정비",
      ],
      shouldQuestion: ["얼굴 벡터 저장과 삭제 정책"],
      mustNotClaim: [FOREIGN_REP, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-007",
    mode: "scan_blueprint",
    title: "KYC 문서 OCR 파이프라인",
    serviceCategory: "금융운영 / 코드 스캔",
    posture: "mixed",
    summary:
      "EasyOCR로 주민등록증과 통장 사본을 읽는 파이프라인이다. 개인정보 컬럼과 금융 맥락이 있지만 자동 거절은 보이지 않는다.",
    benchmarkTags: ["scan", "easyocr", "personal_data"],
    input: {
      repositoryBlueprint: {
        repoName: "kyc-ocr",
        repoStory: "신원확인 문서를 OCR로 읽어 검수 화면에 전달하는 백엔드",
        languages: ["python"],
        manifestDeps: ["easyocr", "pandas"],
        sourceSignals: [
          {
            path: "ocr.py",
            summary:
              "import easyocr / reader.readtext(uploaded_image) / columns: name, birthdate, jumin, account_number",
          },
        ],
        uiSignals: ["검수 담당자 대시보드에서만 사용"],
        complianceSignals: ["개인정보 마스킹 유틸은 있으나 데이터 출처 대장 없음"],
      },
    },
    expected: outcome({
      overallRisk: "low",
      postureAssessment: "mixed",
      applicableObligations: [RISK_MGMT, DATA_GOV],
      serviceProfileHints: {
        primaryDomain: "credit_finance",
        decisionAutomation: "human_in_loop",
        customerExposure: false,
        dataKinds: ["financial", "pii"],
      },
      expectedSystems: [
        {
          catalogEntryId: "py.easyocr",
          risk: "low",
          obligations: [RISK_MGMT, DATA_GOV],
        },
      ],
      mustMention: [
        "OCR 자체는 자동 거절과 다름",
        "개인정보 컬럼 존재",
        "검수 담당자 확인 단계",
      ],
      shouldRecommend: [
        "OCR 결과의 보관·마스킹 정책을 문서화",
        "자동 심사로 재사용되는지 추적",
      ],
      shouldQuestion: ["OCR 결과가 자동 KYC 거절에 이어지는지"],
      mustNotClaim: [NOTICE, HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-008",
    mode: "scan_blueprint",
    title: "HyperCLOVA X 공공 FAQ 챗봇",
    serviceCategory: "공공안내 / 코드 스캔",
    posture: "good",
    summary:
      "국내 모델을 쓰는 FAQ 챗봇이고, 안내 페이지에 AI 응답 문구가 명시돼 있다.",
    benchmarkTags: ["scan", "korean_llm", "good_notice"],
    input: {
      repositoryBlueprint: {
        repoName: "gov-faq-bot",
        repoStory: "공공기관 민원 FAQ를 답하는 챗봇",
        languages: ["typescript"],
        manifestDeps: [],
        sourceSignals: [
          {
            path: "src/lib/clova.ts",
            summary:
              "fetch('https://clovastudio.apigw.ntruss.com/.../chat-completions/HCX-005') / CLOVASTUDIO_API_KEY 사용",
          },
        ],
        uiSignals: ["채팅창 상단에 'AI가 생성한 안내 초안' 문구 존재"],
        complianceSignals: ["상담원 전환 버튼 존재"],
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "good",
      applicableObligations: [RISK_MGMT, NOTICE],
      serviceProfileHints: {
        primaryDomain: "public_service",
        decisionAutomation: "human_in_loop",
        customerExposure: true,
        dataKinds: ["behavioral"],
      },
      expectedSystems: [
        {
          catalogEntryId: "kr.hyperclova",
          risk: "medium",
          obligations: [RISK_MGMT, NOTICE],
        },
      ],
      mustMention: [
        "국내 LLM",
        "고지 문구 존재",
        "상담원 전환 경로",
      ],
      shouldRecommend: [
        "운영 로그를 위험관리 문서와 연결",
        "민원 처리와 FAQ 응답 범위를 분리해 유지",
      ],
      shouldQuestion: ["민원 내용이 학습에 재사용되는지"],
      mustNotClaim: [FOREIGN_REP, HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-009",
    mode: "scan_blueprint",
    title: "Upstage Solar 계약서 요약기",
    serviceCategory: "리걸테크 / 코드 스캔",
    posture: "good",
    summary:
      "Upstage Solar를 쓰는 문서 요약기이며 결과는 법무팀 내부 검토용이다.",
    benchmarkTags: ["scan", "upstage", "internal_assist"],
    input: {
      repositoryBlueprint: {
        repoName: "solar-contract-copilot",
        repoStory: "계약서 업로드 후 요약과 리스크 태그를 보여주는 내부 도구",
        languages: ["python"],
        manifestDeps: ["upstage"],
        sourceSignals: [
          {
            path: "app.py",
            summary:
              "from upstage import ChatUpstage / model='solar-pro' / summary 초안 생성",
          },
        ],
        uiSignals: ["사내 법무 포털에서만 접근 가능"],
        complianceSignals: ["검토자 승인 체크리스트 있음"],
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "good",
      applicableObligations: [RISK_MGMT, NOTICE],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "advisory",
        customerExposure: false,
        dataKinds: ["behavioral"],
      },
      expectedSystems: [
        {
          catalogEntryId: "py.upstage_solar",
          risk: "medium",
          obligations: [RISK_MGMT, NOTICE],
        },
      ],
      mustMention: [
        "국내 모델 사용",
        "내부 법무용 보조도구",
        "검토자 승인 체크리스트",
      ],
      shouldRecommend: [
        "사내 입력 정책과 로그 보존 기준을 최신화",
        "요약 오답 대응 플레이북을 작성",
      ],
      shouldQuestion: ["외부 고객이 직접 업로드하는 경로가 생길 예정인지"],
      mustNotClaim: [FOREIGN_REP, HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-010",
    mode: "scan_blueprint",
    title: "LangChain 세일즈 코파일럿",
    serviceCategory: "영업지원 / 코드 스캔",
    posture: "mixed",
    summary:
      "LangChain과 OpenAI를 함께 쓰는 RAG 도구다. 내부 영업팀 사용이지만 화면 고지는 없고, 고객 메모가 벡터스토어에 저장된다.",
    benchmarkTags: ["scan", "langchain", "rag", "foreign_model"],
    input: {
      repositoryBlueprint: {
        repoName: "sales-copilot",
        repoStory: "영업 메모를 검색해 답변 초안을 만드는 Next.js 앱",
        languages: ["typescript"],
        manifestDeps: ["langchain", "@langchain/openai", "openai"],
        sourceSignals: [
          {
            path: "src/lib/chain.ts",
            summary:
              "new ChatOpenAI({ model: 'gpt-4o-mini' }) / createRetrievalChain(...) / vector store 검색",
          },
        ],
        uiSignals: ["내부 툴 화면에 AI 안내 문구 없음"],
        complianceSignals: ["고객 메모를 벡터스토어에 저장"],
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "mixed",
      applicableObligations: [RISK_MGMT, NOTICE, FOREIGN_REP],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "advisory",
        customerExposure: false,
        dataKinds: ["behavioral", "pii"],
      },
      expectedSystems: [
        {
          catalogEntryId: "ts.langchain",
          risk: "medium",
          obligations: [RISK_MGMT, NOTICE, FOREIGN_REP],
          notes: "RAG 체인 프레임워크",
        },
        {
          catalogEntryId: "ts.openai",
          risk: "medium",
          obligations: [RISK_MGMT, NOTICE, FOREIGN_REP],
          notes: "실제 모델 호출 계층",
        },
      ],
      mustMention: [
        "LangChain과 OpenAI의 조합",
        "고객 메모 저장",
        "내부 툴이지만 생성형 모델 사용 고지/입력정책 필요",
      ],
      shouldRecommend: [
        "내부 사용 가이드와 입력 제한 정책을 표시",
        "벡터스토어에 들어가는 고객 메모 범위를 점검",
      ],
      shouldQuestion: ["고객 메모에 민감정보가 포함되는지"],
      mustNotClaim: [HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-011",
    mode: "scan_blueprint",
    title: "TRL/PEFT 파인튜닝 실험 저장소",
    serviceCategory: "모델학습 / 코드 스캔",
    posture: "poor",
    summary:
      "PEFT, TRL, datasets가 함께 등장하고 개인정보 CSV를 읽는다. 데이터 거버넌스와 출처 관리 여부를 강하게 물어야 하는 사례다.",
    benchmarkTags: ["scan", "fine_tuning", "data_governance"],
    input: {
      repositoryBlueprint: {
        repoName: "customer-support-ft",
        repoStory: "고객 상담 기록으로 LLM을 파인튜닝하는 실험 repo",
        languages: ["python"],
        manifestDeps: ["peft", "trl", "datasets", "transformers", "pandas"],
        sourceSignals: [
          {
            path: "train.py",
            summary:
              "from peft import LoraConfig / from trl import SFTTrainer / load_dataset(...) / pd.read_csv('tickets.csv') / columns: name, email, phone",
          },
        ],
        uiSignals: ["서비스 UI 없음"],
        complianceSignals: ["데이터 출처 대장 없음", "동의 범위 불명확"],
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "poor",
      applicableObligations: [RISK_MGMT, DATA_GOV],
      conditionalObligations: [HIGH_COMPUTE],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "none",
        customerExposure: false,
        dataKinds: ["pii", "behavioral"],
      },
      expectedSystems: [
        {
          catalogEntryId: "py.peft",
          risk: "low",
          obligations: [RISK_MGMT, DATA_GOV],
        },
        {
          catalogEntryId: "py.trl",
          risk: "low",
          obligations: [RISK_MGMT, DATA_GOV],
        },
      ],
      mustMention: [
        "파인튜닝 루프",
        "개인정보 CSV",
        "AIBA-HIGH-COMPUTE는 자동 확정이 아니라 별도 확인 필요",
      ],
      shouldRecommend: [
        "학습 데이터 출처·동의·보존기간을 문서화",
        "고컴퓨트 해당 여부를 별도 점검",
      ],
      shouldQuestion: ["학습 규모가 고컴퓨트 기준에 닿는지"],
      mustNotClaim: [NOTICE, FOREIGN_REP, WATERMARK],
    }),
  },
  {
    id: "scan-012",
    mode: "scan_blueprint",
    title: "vLLM 내부 Q&A 서버",
    serviceCategory: "내부 지식검색 / 코드 스캔",
    posture: "good",
    summary:
      "vLLM으로 사내 지식 Q&A를 서빙하는 저장소다. 외부 사용자 대상 제품은 아니지만 생성형 모델 운영 흔적은 분명하다.",
    benchmarkTags: ["scan", "vllm", "internal_use"],
    input: {
      repositoryBlueprint: {
        repoName: "knowledge-vllm",
        repoStory: "사내 문서를 질의응답하는 internal API",
        languages: ["python"],
        manifestDeps: ["vllm", "fastapi"],
        sourceSignals: [
          {
            path: "server.py",
            summary:
              "from vllm import LLM / app.post('/api/chat') / internal_docs 검색 후 answer 생성",
          },
        ],
        uiSignals: ["사내 포털에만 노출"],
        complianceSignals: ["관리자 접근제어와 운영 로그 있음"],
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "good",
      applicableObligations: [RISK_MGMT, NOTICE],
      serviceProfileHints: {
        primaryDomain: "research_internal",
        decisionAutomation: "advisory",
        customerExposure: false,
        dataKinds: ["behavioral"],
      },
      expectedSystems: [
        {
          catalogEntryId: "py.vllm",
          risk: "medium",
          obligations: [RISK_MGMT, NOTICE],
        },
      ],
      mustMention: ["생성형 내부 Q&A", "사내 전용 운영"],
      shouldRecommend: [
        "사내 사용자 공지와 입력 금지 항목을 명시",
        "운영 로그를 위험관리 문서에 연결",
      ],
      shouldQuestion: ["고객 원문 문서가 섞이는지"],
      mustNotClaim: [FOREIGN_REP, HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-013",
    mode: "scan_blueprint",
    title: "Gemini 기반 증상 상담 봇",
    serviceCategory: "헬스케어 / 코드 스캔",
    posture: "poor",
    summary:
      "Google Generative AI SDK와 의료 키워드가 함께 등장한다. 공개 챗봇이면 고영향 검토가 반드시 나와야 한다.",
    benchmarkTags: ["scan", "medical", "foreign_model", "public_chatbot"],
    input: {
      repositoryBlueprint: {
        repoName: "symptom-bot",
        repoStory: "환자 증상을 받아 진료과를 추천하는 공개 챗봇",
        languages: ["python"],
        manifestDeps: ["google-generativeai", "fastapi"],
        sourceSignals: [
          {
            path: "api.py",
            summary:
              "import google.generativeai as genai / @app.post('/chat') / patient_id, symptom, medication / model.generate_content(...)",
          },
        ],
        uiSignals: ["웹 채팅창에 AI 고지 없음"],
        complianceSignals: ["의료진 승인 단계 없음"],
      },
    },
    expected: outcome({
      overallRisk: "high",
      postureAssessment: "poor",
      applicableObligations: [
        RISK_MGMT,
        NOTICE,
        FOREIGN_REP,
        HIGH_IMPACT,
        IMPACT,
        PUBLIC_DISCLOSURE,
      ],
      serviceProfileHints: {
        primaryDomain: "healthcare",
        decisionAutomation: "fully_automated",
        customerExposure: true,
        dataKinds: ["health", "pii"],
      },
      expectedSystems: [
        {
          catalogEntryId: "py.google_generativeai",
          risk: "high",
          obligations: [
            RISK_MGMT,
            NOTICE,
            FOREIGN_REP,
            HIGH_IMPACT,
            IMPACT,
            PUBLIC_DISCLOSURE,
          ],
        },
      ],
      mustMention: [
        "환자 증상/약물 데이터",
        "공개 의료 챗봇",
        "생성형이더라도 고영향 검토가 필요",
      ],
      shouldRecommend: [
        "의료진 승인 없이 결과가 바로 적용되지 않게 통제",
        "환자 고지와 영향평가를 수행",
      ],
      shouldQuestion: ["추천이 예약·처방 흐름에 자동 연결되는지"],
      mustNotClaim: [WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-014",
    mode: "scan_blueprint",
    title: "Bedrock 기반 구매심사 보조도구",
    serviceCategory: "조달 / 코드 스캔",
    posture: "mixed",
    summary:
      "Bedrock을 사용하지만 최종 승인권자는 구매담당자다. 다만 직원 평가나 채용 결정으로 오인하지 않도록 리포트가 과장하면 안 된다.",
    benchmarkTags: ["scan", "bedrock", "advisory_only"],
    input: {
      repositoryBlueprint: {
        repoName: "procurement-review",
        repoStory: "구매 요청서를 요약하고 리스크 체크리스트를 제안하는 내부 툴",
        languages: ["typescript"],
        manifestDeps: ["@aws-sdk/client-bedrock-runtime"],
        sourceSignals: [
          {
            path: "src/lib/bedrock.ts",
            summary:
              "import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime' / 문서 요약과 리스크 태그 생성",
          },
        ],
        uiSignals: ["내부 구매담당자 화면에서만 사용"],
        complianceSignals: ["승인자 최종 결재 필수"],
      },
    },
    expected: outcome({
      overallRisk: "medium",
      postureAssessment: "mixed",
      applicableObligations: [RISK_MGMT, NOTICE, FOREIGN_REP],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "human_in_loop",
        customerExposure: false,
        dataKinds: ["behavioral"],
      },
      expectedSystems: [
        {
          catalogEntryId: "ts.aws-bedrock",
          risk: "medium",
          obligations: [RISK_MGMT, NOTICE, FOREIGN_REP],
        },
      ],
      mustMention: [
        "내부 구매보조",
        "최종 승인권자는 사람",
        "직원 채용/해고와 같은 고영향 도메인과 구별",
      ],
      shouldRecommend: [
        "내부 사용자 대상 고지와 입력정책을 명시",
        "요약 오류에 대한 검토 로그를 남기기",
      ],
      shouldQuestion: ["협력사 개인정보가 포함되는지"],
      mustNotClaim: [HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
  {
    id: "scan-015",
    mode: "scan_blueprint",
    title: "Ultralytics 안전모 감지 대시보드",
    serviceCategory: "산업안전 / 코드 스캔",
    posture: "good",
    summary:
      "YOLO 기반 안전모 감지 시스템이지만 현장 관리자에게 알림만 준다. 출입 통제나 징계 자동화와는 구분해야 한다.",
    benchmarkTags: ["scan", "vision", "human_review", "low_risk"],
    input: {
      repositoryBlueprint: {
        repoName: "ppe-alert",
        repoStory: "산업현장 CCTV에서 안전모 미착용을 알리는 모니터링 대시보드",
        languages: ["python"],
        manifestDeps: ["ultralytics", "fastapi"],
        sourceSignals: [
          {
            path: "detect.py",
            summary:
              "from ultralytics import YOLO / detect hardhat missing / send Slack alert to supervisor",
          },
        ],
        uiSignals: ["현장 관리자 대시보드 전용"],
        complianceSignals: ["현장 징계는 관리자 판단 후 별도 진행"],
      },
    },
    expected: outcome({
      overallRisk: "low",
      postureAssessment: "good",
      applicableObligations: [RISK_MGMT],
      conditionalObligations: [NOTICE],
      serviceProfileHints: {
        primaryDomain: "general",
        decisionAutomation: "human_in_loop",
        customerExposure: false,
        dataKinds: ["none"],
      },
      expectedSystems: [
        {
          catalogEntryId: "py.ultralytics",
          risk: "low",
          obligations: [RISK_MGMT],
        },
      ],
      mustMention: [
        "알림/보조용 비전 시스템",
        "징계 자동결정과 구별",
      ],
      shouldRecommend: [
        "알림 정확도와 관리자 후속조치 로그를 남기기",
        "작업자 안내 문구 여부를 확인",
      ],
      shouldQuestion: ["추후 출입통제 자동화로 확장될 계획이 있는지"],
      mustNotClaim: [HIGH_IMPACT, WATERMARK, HIGH_COMPUTE],
    }),
  },
];

export const lexosAibaBenchmarkV1: BenchmarkDataset = {
  version: "1.0.0",
  alignedTo:
    "LexOS repository model as of 2026-04-26 (9-obligation AI Basic Act mapping, not standalone legal advice)",
  generatedAt: "2026-04-26",
  scenarioCount: scenarios.length,
  notes: [
    "각 시나리오는 현재 LexOS가 다루는 9개 의무 모델에 맞춰 작성되었습니다.",
    "good/mixed/poor 포지션이 섞여 있으므로, 좋은 사례에서는 기존 통제를 인정하는 서술도 점수에 반영해야 합니다.",
    "scan_blueprint 사례는 실제 공개 저장소 URL 대신 '예상 파일 신호'를 담고 있습니다. 필요하면 이 블루프린트를 미니 fixture repo로 변환해 스캐너 회귀테스트에 사용할 수 있습니다.",
  ],
  scoringGuide: {
    profileMode: [
      {
        id: "risk_match",
        label: "전체 위험도 일치",
        weight: 20,
        rule: "expected.overallRisk와 정확히 같으면 만점",
      },
      {
        id: "obligation_f1",
        label: "의무 매핑 정밀도/재현율",
        weight: 35,
        rule:
          "applicable+conditional 집합을 기준으로 F1 계산. criticalObligations가 누락되면 최대 50% 감점",
      },
      {
        id: "must_mention",
        label: "핵심 사실 언급",
        weight: 15,
        rule: "mustMention 항목을 몇 개 직접 연결해 설명했는지 수동 체크",
      },
      {
        id: "actions_quality",
        label: "실행 가능한 조치",
        weight: 15,
        rule:
          "shouldRecommend 항목을 구체 조치로 바꿔 제시했는지 평가. 추상 조언만 있으면 절반 이하",
      },
      {
        id: "open_questions",
        label: "정보 부족 지점 식별",
        weight: 10,
        rule:
          "shouldQuestion에 대응하는 질문이나 가정이 있으면 가점. 근거 없이 단정하면 감점",
      },
      {
        id: "hallucination_control",
        label: "과장/환각 억제",
        weight: 5,
        rule: "mustNotClaim를 적용으로 단정하지 않으면 만점",
      },
    ],
    scanMode: [
      {
        id: "system_detection_f1",
        label: "시스템 검출 정확도",
        weight: 20,
        rule:
          "expectedSystems.catalogEntryId 집합 기준 F1. 래퍼와 실제 호출 계층을 구분하면 가점",
      },
      {
        id: "risk_match",
        label: "전체 위험도 일치",
        weight: 15,
        rule: "expected.overallRisk와 정확히 같으면 만점",
      },
      {
        id: "obligation_f1",
        label: "의무 매핑 정밀도/재현율",
        weight: 30,
        rule:
          "applicable+conditional 집합 기준 F1. criticalObligations 누락 시 해당 항목 0점",
      },
      {
        id: "service_profile_alignment",
        label: "서비스 맥락 추론",
        weight: 10,
        rule:
          "serviceProfileHints.primaryDomain / decisionAutomation / customerExposure를 얼마나 근접하게 추정했는지 평가",
      },
      {
        id: "must_mention",
        label: "핵심 증거 연결",
        weight: 10,
        rule:
          "mustMention에 있는 코드 신호를 실제 리포트 근거와 연결했는지 평가",
      },
      {
        id: "actions_quality",
        label: "실행 가능한 조치",
        weight: 10,
        rule: "shouldRecommend를 구체 산출물·담당자 중심으로 제안했는지 평가",
      },
      {
        id: "open_questions",
        label: "정보 부족 지점 식별",
        weight: 5,
        rule: "shouldQuestion 항목에 대응하는 확인 질문이 있으면 가점",
      },
    ],
    failureConditions: [
      "mustNotClaim에 있는 의무를 근거 없이 applicable로 단정",
      "good 사례에서 기존 통제를 전혀 인정하지 않고 모두 미준수처럼 서술",
      "scan 사례에서 expectedSystems가 둘 이상인데 하나의 시스템으로 뭉개서 설명",
      "고영향 사례에서 영향평가 또는 고지 이슈를 전혀 언급하지 않음",
    ],
  },
  scenarios,
};

export default lexosAibaBenchmarkV1;
