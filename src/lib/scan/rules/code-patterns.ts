/**
 * 코드 패턴 룰 — 카탈로그(라이브러리)와 별개로 의무 트리거를 추출하는 정규식 룰.
 * 카탈로그 엔트리의 `conditionalObligations.requiresPattern`이 여기 ID를 참조한다.
 */
import { z } from "zod";
import { ObligationIdSchema, DomainSchema } from "../catalog/schema";

export const RuleSeveritySchema = z.enum(["info", "warn", "violation"]);
export type RuleSeverity = z.infer<typeof RuleSeveritySchema>;

export const RuleKindSchema = z.enum([
  "presence", // 패턴 발견 → 신호
  "absence", // presence + absencePatterns 부재 → 위반
  "co_occurrence",
  "extraction",
]);
export type RuleKind = z.infer<typeof RuleKindSchema>;

export interface PatternMatcher {
  pattern: string;
  fileGlob?: string;
  excludeGlob?: string;
}

export interface CodePatternRule {
  id: string;
  description: string;
  descriptionKo: string;
  kind: RuleKind;
  severity: RuleSeverity;
  presencePatterns: PatternMatcher[];
  absencePatterns: PatternMatcher[];
  triggersObligations: z.infer<typeof ObligationIdSchema>[];
  enriches?: {
    domains?: z.infer<typeof DomainSchema>[];
    setTrainsOrFineTunes?: boolean;
    setIsGenerative?: boolean;
    autonomy?: string;
  };
  rationaleKo: string;
}

export const CODE_PATTERN_RULES: CodePatternRule[] = [
  // === 도메인 키워드 ===
  {
    id: "pattern.sensitive_domain_keywords.credit",
    description: "Credit/loan/risk scoring keywords",
    descriptionKo: "신용/대출/심사 변수명",
    kind: "presence",
    severity: "warn",
    presencePatterns: [
      {
        pattern:
          "\\b(credit_score|loan_approval|risk_score|underwriting|scoring_model|debt_ratio)\\b",
        fileGlob: "**/*.{py,ts,tsx,js,jsx,go,java,kt}",
        excludeGlob: "**/{test,tests,__tests__,__mocks__,fixtures}/**",
      },
    ],
    absencePatterns: [],
    triggersObligations: [
      "AIBA-HIGH-IMPACT",
      "AIBA-IMPACT-ASSESSMENT",
      "AIBA-NOTICE",
    ],
    enriches: { domains: ["credit_finance"] },
    rationaleKo:
      "신용평가/대출심사는 AI기본법 제32조 고영향 AI 자동 적용. 제31조 고지·제33조 영향평가 동반.",
  },
  {
    id: "pattern.sensitive_domain_keywords.hr",
    description: "HR/hiring keywords",
    descriptionKo: "채용/HR 키워드",
    kind: "presence",
    severity: "warn",
    presencePatterns: [
      {
        pattern:
          "\\b(resume|candidate_score|hire_decision|screening_model|이력서|지원자|채용평가)\\b",
        excludeGlob: "**/{test,tests,fixtures}/**",
      },
    ],
    absencePatterns: [],
    triggersObligations: [
      "AIBA-HIGH-IMPACT",
      "AIBA-IMPACT-ASSESSMENT",
      "AIBA-NOTICE",
    ],
    enriches: { domains: ["employment"] },
    rationaleKo: "채용 자동심사 — 고영향 AI. 지원자 고지 + 영향평가 의무.",
  },
  {
    id: "pattern.sensitive_domain_keywords.medical",
    description: "Medical/diagnosis keywords",
    descriptionKo: "의료 진단 키워드",
    kind: "presence",
    severity: "warn",
    presencePatterns: [
      {
        pattern:
          "\\b(diagnosis|patient_id|symptom|medication|ehr|emr|진단|환자|증상)\\b",
        excludeGlob: "**/{test,tests,fixtures}/**",
      },
    ],
    absencePatterns: [],
    triggersObligations: [
      "AIBA-HIGH-IMPACT",
      "AIBA-IMPACT-ASSESSMENT",
      "AIBA-NOTICE",
    ],
    enriches: { domains: ["healthcare"] },
    rationaleKo: "의료 진단 AI — 의료기기법 + AI기본법 고영향 AI 동시 적용.",
  },

  // === 학습 코드 ===
  {
    id: "pattern.large_training_loop",
    description: "Training loop with significant scale",
    descriptionKo: "대규모 학습 루프",
    kind: "presence",
    severity: "info",
    presencePatterns: [
      {
        pattern:
          "\\b(Trainer|SFTTrainer|DPOTrainer|lightning\\.Trainer|pl\\.Trainer)\\s*\\(",
        fileGlob: "**/*.py",
      },
      { pattern: "\\bmodel\\.fit\\s*\\(", fileGlob: "**/*.py" },
      { pattern: "\\btrain_loop\\b|\\btraining_step\\b", fileGlob: "**/*.py" },
    ],
    absencePatterns: [],
    triggersObligations: ["AIBA-DATA-GOVERNANCE"],
    enriches: { setTrainsOrFineTunes: true },
    rationaleKo: "학습/파인튜닝 루프 — 데이터 거버넌스 의무.",
  },
  {
    id: "pattern.fine_tuning_loop",
    description: "Fine-tuning specific patterns",
    descriptionKo: "파인튜닝 패턴",
    kind: "presence",
    severity: "info",
    presencePatterns: [
      {
        pattern:
          "\\b(LoraConfig|PeftModel|prepare_model_for_kbit_training|SFTTrainer)\\b",
        fileGlob: "**/*.py",
      },
      { pattern: "openai\\.fine_tuning\\.jobs\\.create" },
    ],
    absencePatterns: [],
    triggersObligations: ["AIBA-DATA-GOVERNANCE"],
    enriches: { setTrainsOrFineTunes: true },
    rationaleKo: "파인튜닝 — 학습 데이터 거버넌스 의무 (제33조).",
  },

  // === 자동결정 ===
  {
    id: "pattern.threshold_decision",
    description: "Threshold-based automated decision",
    descriptionKo: "임계치 기반 자동결정",
    kind: "co_occurrence",
    severity: "warn",
    presencePatterns: [
      {
        pattern: "\\b(score|prob|probability|confidence)\\s*[><=]+\\s*[0-9.]+",
        fileGlob: "**/*.{py,ts,js}",
      },
    ],
    absencePatterns: [],
    triggersObligations: ["AIBA-NOTICE"],
    enriches: { autonomy: "fully_automated" },
    rationaleKo: "임계치 기반 자동결정 패턴 — 도메인 결합 시 고영향 AI 후보.",
  },

  // === 워터마크 ===
  {
    id: "pattern.image_generation_call",
    description: "Image generation API call",
    descriptionKo: "이미지 생성 호출",
    kind: "presence",
    severity: "info",
    presencePatterns: [
      { pattern: "\\.images\\.generate\\(" },
      { pattern: "(StableDiffusion|FluxPipeline|DiffusionPipeline)" },
      { pattern: "\\bdall-?e-?\\d?\\b", fileGlob: "**/*.{py,ts,js}" },
    ],
    absencePatterns: [],
    triggersObligations: ["AIBA-WATERMARK"],
    enriches: { setIsGenerative: true, domains: ["marketing_creative"] },
    rationaleKo: "이미지 생성 — 워터마크 의무 (제31조).",
  },
  {
    id: "pattern.watermark_missing",
    description: "Image generation without watermark/c2pa code",
    descriptionKo: "이미지 생성 + 워터마크 처리 부재 = 위반",
    kind: "absence",
    severity: "violation",
    presencePatterns: [
      {
        pattern: "\\.images\\.generate\\(|StableDiffusion|DiffusionPipeline",
      },
    ],
    absencePatterns: [
      {
        pattern:
          "\\b(watermark|c2pa|piexif|exif|metadata|sign_image|ImageWatermark)\\b",
      },
    ],
    triggersObligations: ["AIBA-WATERMARK"],
    rationaleKo:
      "이미지 생성 호출은 있는데 워터마크/메타데이터 처리 코드가 없음 → 제31조 위반.",
  },

  // === 고지 ===
  {
    id: "pattern.text_generation_user_facing",
    description: "User-facing chat endpoint",
    descriptionKo: "사용자 대상 챗봇 엔드포인트",
    kind: "presence",
    severity: "info",
    presencePatterns: [
      { pattern: "@app\\.(post|route)\\([\"']/chat", fileGlob: "**/*.py" },
      { pattern: "app\\.post\\([\"']/api/chat", fileGlob: "**/*.{ts,js}" },
      {
        pattern: "export\\s+async\\s+function\\s+POST",
        fileGlob: "**/api/**/route.{ts,js}",
      },
      { pattern: "ChatOpenAI|ChatAnthropic|ChatGoogleGenerativeAI" },
    ],
    absencePatterns: [],
    triggersObligations: ["AIBA-NOTICE"],
    rationaleKo: "사용자 대상 챗봇 — 제31조 고지 의무.",
  },
  {
    id: "pattern.notice_missing",
    description: "Chat endpoint without AI disclosure copy",
    descriptionKo: "챗봇 + 고지 문구 부재 = 위반",
    kind: "absence",
    severity: "violation",
    presencePatterns: [
      {
        pattern:
          "@app\\.(post|route)\\([\"']/chat|app\\.post\\([\"']/api/chat",
      },
    ],
    absencePatterns: [
      {
        pattern:
          "(AI 응답|AI가 생성|AI-generated|powered by AI|인공지능|automated response)",
        fileGlob: "**/*.{md,mdx,html,tsx,jsx,vue,svelte}",
      },
    ],
    triggersObligations: ["AIBA-NOTICE"],
    rationaleKo:
      "챗봇 라우트는 있는데 사용자 UI/문서에 AI 고지 문구 없음 → 제31조 위반.",
  },

  // === 데이터 거버넌스 ===
  {
    id: "pattern.dataset_load",
    description: "Dataset loading",
    descriptionKo: "데이터셋 로딩",
    kind: "presence",
    severity: "info",
    presencePatterns: [
      { pattern: "\\bload_dataset\\s*\\(|datasets\\.load_dataset" },
      { pattern: "\\bpd\\.read_csv\\s*\\(", fileGlob: "**/*.py" },
    ],
    absencePatterns: [],
    triggersObligations: ["AIBA-DATA-GOVERNANCE"],
    rationaleKo: "데이터 로딩 — 출처 문서화 필요 (제33조).",
  },
  {
    id: "pattern.personal_data_columns",
    description: "Personal data columns in CSV/code",
    descriptionKo: "개인정보 추정 컬럼",
    kind: "presence",
    severity: "warn",
    presencePatterns: [
      {
        pattern:
          "[\"'](name|email|phone|ssn|jumin|birthdate|이름|이메일|연락처|주민|생년월일)[\"']",
        fileGlob: "**/*.{py,ts,js,csv,sql,yaml}",
      },
    ],
    absencePatterns: [],
    triggersObligations: ["AIBA-DATA-GOVERNANCE"],
    rationaleKo:
      "개인정보 컬럼 의심 → 개인정보보호법 + AI기본법 데이터 거버넌스 동시 점검.",
  },
];

export const CODE_PATTERN_RULES_BY_ID: Map<string, CodePatternRule> = new Map(
  CODE_PATTERN_RULES.map((r) => [r.id, r])
);
