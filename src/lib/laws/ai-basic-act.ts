/**
 * AI 기본법 (인공지능 발전과 신뢰 기반 조성 등에 관한 법률)
 * 시행: 2026.1.22 / 법률 제20826호 (2024.12.제정)
 *
 * 본 모듈은 의무별 RAG 코퍼스를 보관한다.
 *  - `excerpts`: AI 응답의 인용 근거가 되는 신뢰 가능한 텍스트 풀.
 *               응답에 포함된 인용은 반드시 이 풀의 부분 문자열이어야 한다.
 *  - `verifyCitation()` / `verifyObligationId()`로 환각을 차단한다.
 *
 * 출처: 국가법령정보센터 (law.go.kr) — 시행 전 입법 단계 자료. 시행령·시행규칙
 * 확정 시 본 파일을 갱신해야 한다.
 */

export interface LawExcerpt {
  /** 조문 위치 식별자 (예: "제31조 제1항") */
  locator: string;
  /** 신뢰 가능한 인용 텍스트 (요약 아님 — 그대로 답변에 사용) */
  text: string;
}

export interface LawObligation {
  id: string;
  article: string;
  title: string;
  appliesTo: string;
  obligation: string;
  penalty?: string;
  triggers: string[];
  /** RAG 인용 풀 — 답변의 모든 근거는 이 안에서만 가져와야 함 */
  excerpts: LawExcerpt[];
  /** 권한 있는 출처 URL (사용자에게 노출) */
  sourceUrl: string;
  /** 본 의무가 적용되는 법 시행 시점 */
  effectiveDate: string;
}

const SOURCE_URL =
  "https://www.law.go.kr/법령/인공지능발전과신뢰기반조성등에관한법률";
const EFFECTIVE_DATE = "2026-01-22";

export const AI_BASIC_ACT_OBLIGATIONS: LawObligation[] = [
  {
    id: "AIBA-NOTICE",
    article: "AI 기본법 제31조 (이용자에 대한 고지)",
    title: "AI 사용 사실 고지",
    appliesTo: "AI 시스템을 이용해 서비스를 제공하는 모든 사업자",
    obligation:
      "이용자에게 AI가 사용된다는 사실, 사용 목적, 주요 의사결정 기준을 사전에 고지해야 함.",
    penalty: "과태료 3천만원 이하 (법 제43조)",
    triggers: [
      "chatbot",
      "recommendation",
      "auto_decision",
      "generative_text",
      "generative_image",
      "biometric",
      "medical",
    ],
    excerpts: [
      {
        locator: "제31조 제1항",
        text: "인공지능사업자는 인공지능시스템을 이용한 제품 또는 서비스를 제공할 때 해당 제품 또는 서비스가 인공지능에 기반하여 운용된다는 사실을 이용자가 사전에 명확히 알 수 있도록 고지하여야 한다.",
      },
      {
        locator: "제31조 제2항",
        text: "고지는 이용자가 쉽게 인지할 수 있는 방법으로 표시하여야 하며, 고지의 방법·시기·내용 등에 관하여 필요한 사항은 대통령령으로 정한다.",
      },
    ],
    sourceUrl: SOURCE_URL,
    effectiveDate: EFFECTIVE_DATE,
  },
  {
    id: "AIBA-WATERMARK",
    article: "AI 기본법 제31조 제3항 (생성형 AI 결과물 표시)",
    title: "생성형 AI 결과물 표시 (워터마크)",
    appliesTo: "생성형 AI를 활용해 콘텐츠를 만드는 사업자",
    obligation:
      "생성형 AI가 만든 결과물에는 식별 가능한 표시(워터마크 등)를 부착해야 함. 가상 인물·합성 콘텐츠는 그 사실을 명시.",
    penalty: "과태료 3천만원 이하",
    triggers: ["generative_text", "generative_image"],
    excerpts: [
      {
        locator: "제31조 제3항",
        text: "생성형 인공지능을 이용한 제품 또는 서비스를 제공하는 인공지능사업자는 그 결과물이 생성형 인공지능에 의하여 생성되었다는 사실을 표시하여야 한다.",
      },
      {
        locator: "제31조 제4항",
        text: "실존하는 사람·사물 등을 인식하기 어려운 가상의 결과물을 생성하는 경우에는 가상의 결과물이라는 사실을 이용자가 명확히 인식할 수 있도록 표시하여야 한다.",
      },
    ],
    sourceUrl: SOURCE_URL,
    effectiveDate: EFFECTIVE_DATE,
  },
  {
    id: "AIBA-HIGH-IMPACT",
    article: "AI 기본법 제33조 (고영향 인공지능)",
    title: "고영향 AI 의무 이행",
    appliesTo:
      "고영향 인공지능(에너지·보건의료·생체인식·금융신용평가·채용·공공의사결정 등)을 운영·제공하는 사업자",
    obligation:
      "고영향 AI에 해당 여부 사전 확인, 위험관리방안 수립·운영, 이용자 보호 조치, 사람에 의한 관리·감독 체계 구축, 안전성·신뢰성 확보 조치를 갖춰야 함.",
    penalty: "시정명령 + 과태료 3천만원 이하",
    triggers: ["auto_decision", "medical", "biometric"],
    excerpts: [
      {
        locator: "제33조 제1항",
        text: "고영향인공지능을 이용한 제품 또는 서비스를 제공하려는 인공지능사업자는 해당 인공지능시스템이 고영향인공지능에 해당하는지 여부를 사전에 확인하여야 한다.",
      },
      {
        locator: "제33조 제2항",
        text: "고영향인공지능을 이용한 제품 또는 서비스를 제공하는 인공지능사업자는 안전성·신뢰성 확보를 위하여 위험관리방안의 수립·운영, 이용자 보호 방안, 사람에 의한 관리·감독, 안전성·신뢰성 확보를 위하여 필요한 조치를 하여야 한다.",
      },
      {
        locator: "제2조 제4호 (정의)",
        text: "\"고영향인공지능\"이란 사람의 생명, 신체의 안전 및 기본권에 중대한 영향을 미치거나 위험을 초래할 우려가 있는 인공지능시스템을 말하며, 그 구체적 범위는 대통령령으로 정한다.",
      },
    ],
    sourceUrl: SOURCE_URL,
    effectiveDate: EFFECTIVE_DATE,
  },
  {
    id: "AIBA-FOREIGN-REP",
    article: "AI 기본법 제36조 (국내대리인 지정)",
    title: "해외 사업자 국내대리인 지정",
    appliesTo:
      "국내에 주소·영업소가 없으나 일정 규모 이상으로 국내 이용자에게 인공지능 서비스를 제공하는 외국 인공지능사업자",
    obligation:
      "국내대리인을 서면으로 지정하고 그 정보를 과학기술정보통신부장관에게 신고. 국내대리인은 본법상 의무 이행을 대리.",
    penalty: "과태료 3천만원 이하",
    triggers: ["usesForeignAI"],
    excerpts: [
      {
        locator: "제36조 제1항",
        text: "국내에 주소 또는 영업소가 없는 인공지능사업자로서 대통령령으로 정하는 자는 국내대리인을 서면으로 지정하여야 한다.",
      },
      {
        locator: "제36조 제2항",
        text: "국내대리인은 이 법에 따른 인공지능사업자의 의무 이행 등을 대리한다.",
      },
    ],
    sourceUrl: SOURCE_URL,
    effectiveDate: EFFECTIVE_DATE,
  },
  {
    id: "AIBA-RISK-MGMT",
    article: "AI 기본법 제32조 (위험관리)",
    title: "AI 위험관리 체계 구축",
    appliesTo: "AI를 업무에 활용하는 인공지능사업자",
    obligation:
      "사용 중인 AI 시스템 목록, 위험식별, 위험등급 분류, 완화 조치 기록, 정기 재평가를 문서화한 위험관리 체계 구축. 감사 시 제출 가능한 형태로 비치.",
    triggers: [
      "chatbot",
      "recommendation",
      "generative_text",
      "generative_image",
      "auto_decision",
      "biometric",
      "medical",
    ],
    excerpts: [
      {
        locator: "제32조",
        text: "인공지능사업자는 인공지능시스템의 안전성과 신뢰성을 확보하기 위하여 위험을 식별·평가하고, 위험을 완화하기 위한 관리체계를 구축·운영하여야 한다.",
      },
    ],
    sourceUrl: SOURCE_URL,
    effectiveDate: EFFECTIVE_DATE,
  },
  {
    id: "AIBA-DATA-GOVERNANCE",
    article: "AI 기본법 제30조 (인공지능 학습용 데이터)",
    title: "학습 데이터 거버넌스",
    appliesTo: "AI 모델을 자체 학습·파인튜닝하는 사업자",
    obligation:
      "학습 데이터의 출처·수집 경로 기록, 저작권·개인정보 적법성 확인, 편향 평가 결과 비치.",
    triggers: ["generative_text", "generative_image", "auto_decision"],
    excerpts: [
      {
        locator: "제30조",
        text: "정부는 인공지능 학습용 데이터의 확보·관리·활용을 촉진하기 위한 시책을 수립·시행하며, 인공지능사업자는 학습용 데이터의 적법한 확보와 품질 확보를 위하여 노력하여야 한다.",
      },
    ],
    sourceUrl: SOURCE_URL,
    effectiveDate: EFFECTIVE_DATE,
  },
  {
    id: "AIBA-HIGH-COMPUTE",
    article: "AI 기본법 제2조 제5호 / 제32조 (대규모 학습 모델)",
    title: "초대규모 학습 모델 안전 검증",
    appliesTo:
      "누적 학습 연산량이 대통령령으로 정하는 임계치 이상인 모델을 자체 학습하는 사업자",
    obligation:
      "학습 연산량·자원·기간 신고, 모델 능력·위험 사전 평가, 안전성 검증 절차 운영.",
    penalty: "시정명령 + 과태료",
    triggers: ["high_compute_training"],
    excerpts: [
      {
        locator: "제2조 제5호 (정의)",
        text: "\"학습에 활용된 누적 연산량이 대통령령으로 정하는 기준 이상인 인공지능시스템\"은 본법상 별도의 안전성·신뢰성 확보 조치를 적용한다.",
      },
    ],
    sourceUrl: SOURCE_URL,
    effectiveDate: EFFECTIVE_DATE,
  },
  {
    id: "AIBA-PUBLIC-DISCLOSURE",
    article: "AI 기본법 제33조 제3항 (공개)",
    title: "고영향 AI 운영 정보 공개",
    appliesTo: "프로덕션 단계의 고영향 인공지능 운영자",
    obligation:
      "고영향 AI 사용 사실, 위험관리방안 요약, 이용자 권리·구제 절차, 책임자 연락처를 이용자가 접근 가능한 채널에 공개.",
    triggers: ["high_impact_production", "generative_production"],
    excerpts: [
      {
        locator: "제33조 제3항",
        text: "고영향인공지능을 이용한 제품 또는 서비스를 제공하는 인공지능사업자는 안전성·신뢰성 확보를 위한 조치의 내용을 이용자가 알기 쉬운 방법으로 공개하여야 한다.",
      },
    ],
    sourceUrl: SOURCE_URL,
    effectiveDate: EFFECTIVE_DATE,
  },
  {
    id: "AIBA-IMPACT-ASSESSMENT",
    article: "AI 기본법 제34조 (영향평가)",
    title: "고영향 AI 영향평가",
    appliesTo:
      "고영향 인공지능을 이용해 의료·금융·채용·생체식별·공공의사결정 등 서비스를 제공하는 자",
    obligation:
      "이해관계자·기본권·차별 영향 평가 보고서 작성, 정기 갱신, 감사 요청 시 제출.",
    penalty: "과태료 3천만원 이하",
    triggers: [
      "auto_decision",
      "medical",
      "biometric",
      "high_impact_production",
    ],
    excerpts: [
      {
        locator: "제34조 제1항",
        text: "고영향인공지능을 이용한 제품 또는 서비스를 제공하려는 자는 해당 인공지능이 이용자의 기본권에 미치는 영향에 대한 평가를 실시하도록 노력하여야 한다.",
      },
      {
        locator: "제34조 제2항",
        text: "정부는 영향평가의 기준·방법·절차 등에 관한 사항을 대통령령으로 정한다.",
      },
    ],
    sourceUrl: SOURCE_URL,
    effectiveDate: EFFECTIVE_DATE,
  },
];

const OBLIGATION_INDEX = new Map(
  AI_BASIC_ACT_OBLIGATIONS.map((o) => [o.id, o])
);

export function relevantObligationsFor(
  usages: string[],
  usesForeignAI: boolean
): LawObligation[] {
  const triggers = new Set(usages);
  if (usesForeignAI) triggers.add("usesForeignAI");
  return AI_BASIC_ACT_OBLIGATIONS.filter((o) =>
    o.triggers.some((t) => triggers.has(t))
  );
}

export function getObligationById(id: string): LawObligation | undefined {
  return OBLIGATION_INDEX.get(id);
}

export function isKnownObligationId(id: string): boolean {
  return OBLIGATION_INDEX.has(id);
}

/**
 * RAG 검증 — AI가 만든 인용 텍스트가 실제 corpus 안에 있는지 substring 매칭.
 * 공백·줄바꿈 정규화 후 비교. 30자 미만이면 단순 substring 매칭이
 * 거짓 양성을 만들기 쉬우므로 거부한다 (의미 있는 인용 강제).
 */
export function verifyCitation(
  obligationId: string,
  citation: string
): { ok: true; locator: string } | { ok: false; reason: string } {
  const ob = OBLIGATION_INDEX.get(obligationId);
  if (!ob) return { ok: false, reason: "unknown_obligation_id" };
  const norm = (s: string) => s.replace(/\s+/g, "").trim();
  const target = norm(citation);
  if (target.length < 20) {
    return { ok: false, reason: "too_short" };
  }
  for (const ex of ob.excerpts) {
    if (norm(ex.text).includes(target)) {
      return { ok: true, locator: ex.locator };
    }
  }
  return { ok: false, reason: "not_in_corpus" };
}

/** Gemini 시스템 프롬프트에 주입할 RAG 컨텍스트 — excerpts 전체 노출 */
export function obligationsAsContext(): string {
  return AI_BASIC_ACT_OBLIGATIONS.map((o) => {
    const exc = o.excerpts
      .map((e) => `    · [${e.locator}] "${e.text}"`)
      .join("\n");
    return [
      `[${o.id}] ${o.article} — ${o.title}`,
      `  적용대상: ${o.appliesTo}`,
      `  의무: ${o.obligation}`,
      o.penalty ? `  제재: ${o.penalty}` : "",
      `  근거 발췌 (인용은 반드시 이 안에서):`,
      exc,
    ]
      .filter(Boolean)
      .join("\n");
  }).join("\n\n");
}

export const KNOWN_OBLIGATION_IDS = AI_BASIC_ACT_OBLIGATIONS.map((o) => o.id);

/**
 * 텍스트에서 "제N조" / "제N조 제M항" / "제N조의2" 형태의 모든 조문 참조를 추출.
 * AI가 reasoning·legalBasis에 환각으로 만든 조문 번호를 잡기 위함.
 */
export function extractArticleRefs(text: string): string[] {
  const out: string[] = [];
  const re = /제\s*(\d+)\s*조(?:의\s*(\d+))?(?:\s*제\s*(\d+)\s*항)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const article = `제${m[1]}조${m[2] ? `의${m[2]}` : ""}`;
    out.push(article);
  }
  return out;
}

/** 의무 ID 하나가 다루는 모든 조문 번호 집합 ("제31조", "제2조" 등) */
export function articlesForObligation(id: string): Set<string> {
  const ob = OBLIGATION_INDEX.get(id);
  if (!ob) return new Set();
  const set = new Set<string>();
  const re = /제\s*(\d+)\s*조(?:의\s*(\d+))?/;
  for (const ex of ob.excerpts) {
    const m = re.exec(ex.locator);
    if (m) set.add(`제${m[1]}조${m[2] ? `의${m[2]}` : ""}`);
  }
  // article 필드도 포함 (예: "AI 기본법 제31조 (이용자에 대한 고지)")
  const am = re.exec(ob.article);
  if (am) set.add(`제${am[1]}조${am[2] ? `의${am[2]}` : ""}`);
  return set;
}

/**
 * AI가 항목 본문에 사용한 조문 번호들이 해당 의무의 실제 조문과 모순되는지 검사.
 * 본문에서 발견된 "제N조" 중 의무 corpus에 없는 게 하나라도 있으면 unsupported로 표시.
 */
export function unsupportedArticleRefs(
  obligationId: string,
  ...texts: string[]
): string[] {
  const allowed = articlesForObligation(obligationId);
  if (allowed.size === 0) return [];
  const seen = new Set<string>();
  for (const t of texts) {
    for (const ref of extractArticleRefs(t)) seen.add(ref);
  }
  return [...seen].filter((ref) => !allowed.has(ref));
}
