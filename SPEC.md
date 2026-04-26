# LexOS 기능 명세서

> 한국 AI기본법(2026.1.22 시행) 컴플라이언스 자동화 SaaS — MVP 기능 명세 v1.

---

## 1. 시스템 개요

### 1.1 목적
법무팀이 AI기본법 9개 의무에 대한 적용 여부를 수동으로 점검하는 대신, **회사 프로필** 또는 **GitHub 저장소 URL** 입력만으로:
1. 사용 중인 AI 시스템을 자동 식별
2. 시스템별 위험등급(high/medium/low) 산출
3. 트리거되는 의무를 자동 매핑
4. 비기술자가 이해할 수 있는 자연어 설명 + 실행 가능한 조치 항목 제공

### 1.2 사용자 페르소나
| 역할 | 1차 사용 시나리오 |
|---|---|
| 컴플라이언스 담당자 | `/diagnose`로 자사 AI 사용 현황 진단 → 의무 체크리스트 확보 |
| 보안/개발 리더 | `/scan`으로 사내 저장소 스캔 → 미인지 AI 시스템 발견 |
| 법무 자문 | `/dashboard`에서 여러 진단 결과 비교 + 우선순위 결정 |

### 1.3 비목표 (MVP에서 제외)
- 다중 사용자/조직 관리 (인증·권한)
- 의무 이행 워크플로 추적 (체크리스트 영속)
- 코드 리포트의 PDF 출력
- 정기 자동 스캔 / CI 통합

---

## 2. 시스템 구성

```
┌────────────────────────┐    ┌──────────────────────────────────┐
│  Browser (Next.js UI)  │───▶│  /api/diagnose (Gemini 2.5 Flash)│
│  - /dashboard          │    └──────────────────────────────────┘
│  - /scan               │
│  - /  (회사 진단 폼)   │    ┌──────────────────────────────────┐
│  - localStorage 이력   │───▶│  /api/scan                       │
└────────────────────────┘    │   1) collector (git clone 샌드박스)│
                              │   2) analyzer (manifest+regex)    │
                              │   3) synthesizer (결정적 그루핑)  │
                              │   4) refine (Gemini, optional)    │
                              └──────────────────────────────────┘
```

### 2.1 기술 스택
- 프론트: Next.js 16.2.4 (App Router, Turbopack), React 19, Tailwind 4
- 백엔드: Next.js Route Handlers (Node.js runtime, maxDuration 60~120초)
- LLM: Google Gemini 2.5 Flash (`@google/genai`)
- 검증: Zod 4
- 카탈로그: YAML (빌드 타임 로드 + 모듈 캐시)
- 저장: 브라우저 localStorage (이력 50건 캡)

---

## 3. 진입점 (3개 페이지)

### 3.1 `/dashboard` — 대시보드 (기본 진입점)

**목적**: 진단/스캔 이력을 한눈에 보고 다음 작업으로 빠르게 이동.

**구성**
1. 빠른 진입 카드 2개: "코드 스캔" / "회사 진단"
2. KPI 4개: 총 이력, 코드 스캔 건수, 회사 진단 건수, HIGH 위험 건수
3. 필터 (전체/스캔/진단) + 이력 리스트
4. 각 항목: 타입 뱃지 / 위험 뱃지 / 일시 / 제목 / "보기" 링크 / "삭제" 버튼
5. "전체 삭제" 버튼

**상호작용**
- 카드 "보기" 클릭 → `/dashboard/{id}` 이동 (저장된 결과 재표시)
- 빈 상태: "아직 이력이 없습니다. 위 카드에서 스캔 또는 진단을 시작하세요."

**데이터 출처**: `localStorage["lexos:history:v1"]` (클라이언트 전용)

---

### 3.2 `/dashboard/{id}` — 이력 상세

저장된 스캔 또는 진단 결과를 원본 그대로 재렌더.
- 스캔 → `ScanResultView` 컴포넌트 재사용 (Gemini refinement 포함)
- 진단 → 회사 프로필 스냅샷 + 9개 의무 카드

이력이 없으면 "이력을 찾을 수 없습니다" + 대시보드 복귀 링크.

---

### 3.3 `/` — 회사 프로필 진단 (Gemini 100%)

**입력 (폼)**
| 필드 | 타입 | 필수 | 검증 |
|---|---|---|---|
| `name` | string | ✓ | 1자 이상 |
| `industry` | string | ✓ | 1자 이상 |
| `employeeCount` | number | ✓ | ≥1 정수 |
| `annualRevenueKRW` | number | ✓ | ≥0 정수 |
| `aiUsages` | enum[] | ✓ | 최소 1개 |
| `usesForeignAI` | boolean | ✓ | — |
| `notes` | string | — | 옵션 |

`aiUsages` enum: `chatbot` / `recommendation` / `generative_text` / `generative_image` / `auto_decision` / `biometric` / `medical` / `none`

**처리**
1. Zod 검증
2. `relevantObligationsFor(aiUsages, usesForeignAI)`로 1차 트리거 의무 산출
3. Gemini 2.5 Flash 호출 (structured output)
4. `DiagnosisResultSchema`로 응답 파싱

**출력 (`DiagnosisResult`)**
- `overallRisk`: high/medium/low/none
- `summary`: 임원용 30초 요약 3~4문장
- `items[]` (의무별):
  - `obligationId`, `title`, `legalBasis`
  - `applicability`: applicable / conditional / not_applicable
  - `riskLevel`, `reasoning`
  - `actionItems[]` (체크박스로 표시)
  - `deadline` (예: "2026-01-22 시행 전")
  - `evidenceTypes[]` (감사 시 제출 자료)
- `recommendedNextSteps[]`: Top 3

**자동 저장**: 결과 도착 시 `saveEntry({ type: "diagnose", title: name, ... })`

---

### 3.4 `/scan` — GitHub 저장소 코드 스캔

**입력**
- `repoUrl`: HTTPS URL 1개

**처리 파이프라인**
1. **collector** (`/api/scan` → `collectRepo`)
   - 호스트 화이트리스트 검증: `github.com`, `gitlab.com`, `bitbucket.org`, `codeberg.org`
   - owner/repo 정규식 검증: `^[A-Za-z0-9._-]+$`
   - `mkdtemp` 격리 디렉토리에 git clone
   - 보안 옵션: `core.hooksPath=/dev/null`, `protocol.file.allow=never`, `--filter=blob:limit=10m`, `--depth=1 --no-tags --single-branch`
   - 심볼릭 링크 거부, 제외 디렉토리 (`node_modules`, `vendor`, `.venv`, `dist`, `build`)
2. **analyzer** (`analyzeRepo`)
   - 파일 트리 + 언어 통계 산출
   - manifest 파싱 (`package.json`, `requirements.txt`, `pyproject.toml` 등)
   - 소스 정규식 매칭 (import, env_var, call, api_host, code_pattern)
   - 테스트 파일은 별도 분류 (가중치 강등)
3. **synthesizer** (`synthesizeSystems`)
   - Finding을 dirRoot 단위로 그루핑
   - 카탈로그 추론 적용 (`procurement`, `modelProvider`, `domains`, `modalities`, `isGenerative`)
   - 위험등급 결정 (3.4.1 참조)
   - 의무 매핑 (3.4.2 참조)
   - 신뢰도 계산 (dead-code 강등)
4. **refine** (`refineScan`, optional)
   - `GEMINI_API_KEY` 있을 때만 실행
   - 상위 10개 시스템에 대해 Gemini 호출
   - 결정적 결과는 변경하지 않고 **추가 서술 필드만 생성**
5. **cleanup**: 임시 디렉토리 항상 삭제 (성공/실패 무관)

**출력**: `ScanResponse` (5절 참조)

**UI 표시**
- 상단 요약 배너: 저장소 URL / 커밋 SHA / 검출 시스템 수 / 트리거 의무 수 / 분석 파일 수 / 신호 수
- Gemini 종합 의견 패널 (refinement 있을 때): `overallSummary` + `topPriority`
- 시스템 카드 (우선순위 desc → 위험등급 desc 정렬):
  - 헤더: 카탈로그 ID / 이름 / 위험·우선순위·신뢰 뱃지
  - 본문: `humanSummary` (없으면 `purpose` fallback)
  - 토글 1: "왜 이 등급인가?" → `riskNarrative` (open 기본값)
  - 토글 2: "지금 해야 할 일" → `mitigations[]` 체크리스트 (open 기본값)
  - 토글 3: "정보 부족" → `gaps[]`
  - 토글 4: "트리거된 의무" → `triggeredObligations[]` 칩
  - 토글 5: "기술 메타데이터" → procurement, 공급사, 모델, 도메인 등
  - 토글 6: "근거 파일" → `evidence.filePaths[]` (최대 30개)
- 하단: "라이브러리 비매칭 코드 패턴" 접이식 (rule ID + 파일:라인)

**자동 저장**: 결과 도착 시 `saveEntry({ type: "scan", title: repoUrl, ... })`

#### 3.4.1 위험등급 산출 (`derivedRiskTier`)

| 등급 | 조건 |
|---|---|
| `high` | 고영향 도메인 ∋ `domains` AND (`autonomyHint == "fully_automated"` OR `!isGenerative`) |
| `medium` | `isGenerative == true` |
| `low` | 그 외 |

**고영향 도메인**: `credit_finance`, `employment`, `healthcare`, `biometric_id`, `law_enforcement`

#### 3.4.2 의무 트리거 규칙

| 의무 ID | 자동 트리거 조건 |
|---|---|
| `AIBA-RISK-MGMT` | 모든 시스템 (무조건) |
| `AIBA-NOTICE` | `isGenerative == true` |
| `AIBA-FOREIGN-REP` | `isForeignModel == true`. 한국 모델 prefix(`upstage/`, `solar-`, `lgai-exaone/`, `exaone-`, `naver/`, `kt-`, `hcx-`)면 자동 제거 |
| `AIBA-WATERMARK` | 카탈로그 `conditionalObligations` 또는 코드 패턴 룰 매칭 (이미지 생성 호출 등) |
| `AIBA-DATA-GOVERNANCE` | `trainsOrFineTunes == true` (PEFT/TRL/Accelerate 등 검출) |
| `AIBA-HIGH-IMPACT` | `tier == "high"` 또는 코드 패턴 룰 (credit/HR/medical 키워드) |
| `AIBA-IMPACT-ASSESSMENT` | `tier == "high"` |
| `AIBA-PUBLIC-DISCLOSURE` | `tier == "high"` |
| `AIBA-HIGH-COMPUTE` | (현재 자동 트리거 없음) 카탈로그에서 명시적으로 추가한 경우만 |

#### 3.4.3 신뢰도 산출 (`confidence`)

| 단계 | 규칙 |
|---|---|
| 시작 | 카탈로그 엔트리의 `confidence` 값 |
| 강등 1 | `import`만 있고 `env_var`/`call`/`api_host` 없음 → 1단계 ↓ (dead code 가능성) |
| 강등 2 | `manifest_dep`만 있고 import 0건 → 2단계 ↓ |

`high → medium → low → low` 순서.

---

## 4. API 명세

### 4.1 `POST /api/diagnose`

**요청 본문**: `CompanyProfile` (3.3 입력 표 참조)

**응답 (200)**
```jsonc
{
  "ok": true,
  "profile": { /* 입력 그대로 */ },
  "result": { /* DiagnosisResult */ }
}
```

**오류**
- 400: `JSON 파싱 실패` / `입력 검증 실패` (`issues`: Zod flatten)
- 500: `진단 실패` (`detail`: 에러 메시지)

**제약**: maxDuration 60초

---

### 4.2 `POST /api/scan`

**요청 본문**
```json
{ "repoUrl": "https://github.com/owner/repo" }
```

**응답 (200)**
```jsonc
{
  "ok": true,
  "repoUrl": "https://github.com/...",
  "commitSha": "ec8890d101bd...",
  "stats": {
    "totalFiles": 7,
    "languageStats": { "python": 5, "typescript": 2 },
    "totalFindings": 12
  },
  "systems": [ /* AISystem[] */ ],
  "unattributedFindings": [ /* Finding[] (최대 50개) */ ],
  "refinement": {
    "overallSummary": "...",
    "topPriority": "...",
    "systems": [ /* RefinedSystem[] */ ]
  },
  "refineError": null
}
```

**`refinement` 동작**
- `GEMINI_API_KEY` 미설정 → `null`
- Gemini 호출 실패 → `null` + `refineError`에 메시지
- 11번째 이후 시스템은 refinement 미생성 (결정적 결과만 노출)

**오류**
- 400: `JSON 파싱 실패` / `입력 검증 실패` / `수집 실패` (호스트 거부, clone 실패 등 — `reason`/`stderr` 동봉)
- 500: `분석 실패`

**제약**: maxDuration 120초, clone 타임아웃 90초, 최대 5000 파일

---

## 5. 데이터 모델

### 5.1 `AISystem` ([src/lib/scan/synthesizer/schema.ts](CMUX-HACKATHON/src/lib/scan/synthesizer/schema.ts))
| 필드 | 타입 | 비고 |
|---|---|---|
| `id` | string | `synth-{sha1(group.key)[:10]}` |
| `name` | string | `{nameKo}` 또는 `{nameKo} ({modelName})` |
| `purpose` | string | "{dirHint} 모듈에서 {nameKo} 사용" |
| `catalogEntryId` | string | 주된 카탈로그 엔트리 ID |
| `procurement` | enum | `third_party_api` / `self_hosted` / `... ` |
| `modelProvider` | string | "OpenAI" 등 |
| `modelName` | string? | 검출된 경우만 |
| `isForeignModel` | boolean | 한국 모델 prefix 자동 보정 |
| `domains` | enum[] | 카탈로그 hint + 코드 패턴 enrichment |
| `modalities` | enum[] | text/image/audio/multimodal |
| `isGenerative` | boolean | — |
| `trainsOrFineTunes` | boolean | — |
| `derivedRiskTier` | enum | high/medium/low |
| `triggeredObligations` | enum[] | 9개 의무 ID 부분집합 |
| `confidence` | enum | high/medium/low |
| `evidence` | object | `catalogEntryIds[]`, `ruleIds[]`, `filePaths[]` |

### 5.2 `ScanRefinement` ([src/lib/gemini/refine-scan.ts](CMUX-HACKATHON/src/lib/gemini/refine-scan.ts))
```ts
{
  overallSummary: string;       // 전체 저장소 핵심 리스크 2~3문장
  topPriority: string;          // 가장 먼저 처리할 시스템 1개 + 이유
  systems: RefinedSystem[];
}

RefinedSystem = {
  systemId: string;             // AISystem.id 와 매칭
  humanSummary: string;         // 비기술자 대상 2문장 — 비즈니스 행위 중심
  riskNarrative: string;        // 왜 이 등급인지 + 우려 시나리오 3~4문장
  mitigations: string[];        // 실행 가능 조치 3~5개, 명령형 동사
  priorityScore: 1|2|3|4|5;     // 1=긴급, 5=여유
  gaps: string[];               // 정보 부족 영역
}
```

### 5.3 `HistoryEntry` ([src/lib/storage/history.ts](CMUX-HACKATHON/src/lib/storage/history.ts))
```ts
{
  id: string;                   // h-{base36(now)}-{rand6}
  type: "scan" | "diagnose";
  createdAt: string;            // ISO
  title: string;                // repoUrl 또는 회사명
  overallRisk: string;          // "high" | "medium" | "low" | "none"
  systemCount?: number;         // scan만
  obligationCount?: number;     // diagnose만 (applicability != not_applicable)
  payload: unknown;             // 전체 응답 JSON (재렌더용)
}
```

### 5.4 `DiagnosisResult` ([src/lib/types.ts](CMUX-HACKATHON/src/lib/types.ts))
```ts
{
  overallRisk: "high"|"medium"|"low"|"none";
  summary: string;
  items: DiagnosisItem[];       // 9개 의무 각각
  recommendedNextSteps: string[]; // Top 3
}

DiagnosisItem = {
  obligationId, title, legalBasis,
  applicability: "applicable"|"conditional"|"not_applicable",
  riskLevel: "high"|"medium"|"low"|"none",
  reasoning: string,
  actionItems: string[],
  deadline: string,
  evidenceTypes: string[]
}
```

---

## 6. 카탈로그

### 6.1 위치 / 형식
`src/lib/scan/catalog/entries/{eco}/{name}.yaml` — 빌드 시 Zod 검증.

### 6.2 현재 커버 (40 엔트리)
| 카테고리 | 엔트리 |
|---|---|
| Python LLM API | openai, anthropic, google_generativeai, mistralai, cohere, groq, together, replicate, vertexai |
| Python 프레임워크 | langchain, llama_index, transformers, diffusers |
| Python 학습/파인튜닝 | peft, trl, accelerate, sentence_transformers, vllm |
| Python 비전 | ultralytics, easyocr, mediapipe, face_recognition |
| Python 전통 ML | xgboost, lightgbm, sklearn, spacy |
| Python 로컬 런타임 | ollama |
| TypeScript LLM | openai, vercel_ai, langchain, llamaindex, ollama, anthropic-sdk, google-genai, cohere-ai, aws-bedrock, huggingface-inference, xenova-transformers |
| 한국 모델 | hyperclova (CLOVA Studio), upstage_solar |

### 6.3 엔트리 스키마 필수 필드
- `id`: `{eco}.{name}` 형식
- `name`, `nameKo`
- `category`
- `patterns`: `{ manifest, imports, envVars, calls, apiHosts, codePatternRuleIds }`
- `inferences`: `{ procurement, modelProvider, modalities, domainHints, isGenerative, trainsOrFineTunes, isForeignModel, autonomyHint, autoTriggeredObligations, conditionalObligations, knownModels }`
- `confidence`: high/medium/low (시작값)
- `descriptionKo`
- `addedAt`

### 6.4 코드 패턴 룰 (12개, 카탈로그 외)
`src/lib/scan/rules/code-patterns.ts`에 정의. 카탈로그 매칭과 별개로 도메인 키워드(credit/HR/medical), 파인튜닝 루프, 임계치 결정, 워터마크 누락 등을 검출해 추가 의무 트리거 또는 기존 시스템 enrichment.

---

## 7. AI기본법 9개 의무

| ID | 한국어 | 근거 (예) |
|---|---|---|
| AIBA-NOTICE | AI 사용 고지 | 제31조 |
| AIBA-RISK-MGMT | 위험관리체계 구축 | 제32조 |
| AIBA-FOREIGN-REP | 국내 대리인 지정 | 제35조 |
| AIBA-WATERMARK | 생성물 워터마크 | 제31조 |
| AIBA-DATA-GOVERNANCE | 학습데이터 거버넌스 | 제30조 |
| AIBA-HIGH-IMPACT | 고영향 AI 등록 | 제33조 |
| AIBA-IMPACT-ASSESSMENT | 영향평가 수행 | 제34조 |
| AIBA-PUBLIC-DISCLOSURE | 공개공시 | 제33조 |
| AIBA-HIGH-COMPUTE | 대규모 컴퓨팅 신고 | 제29조 |

상세 정의·`obligationsAsContext()`: [src/lib/laws/ai-basic-act.ts](CMUX-HACKATHON/src/lib/laws/ai-basic-act.ts)

---

## 8. 보안 모델

### 8.1 외부 코드 격리 (`/scan`)
- 호스트 화이트리스트: github / gitlab / bitbucket / codeberg
- HTTPS 스킴 강제, SSH URL 거부
- owner/repo 정규식 검증
- `mkdtemp` 격리 — 부모 파일시스템 접근 불가
- git 보안 옵션 (`hooksPath=/dev/null`, `protocol.file.allow=never`, blob 10MB 캡)
- 심볼릭 링크 발견 시 스킵
- 제외 디렉토리: `node_modules`, `vendor`, `.venv`, `dist`, `build`
- 작업 후 항상 cleanup (`finally`)

### 8.2 Gemini 호출
- API 키는 서버 사이드 환경변수 (`GEMINI_API_KEY`)에만 저장
- 응답은 Zod 스키마 + structured output로 강제 — 임의 코드 실행 위험 없음
- Refine 입력에 코드 본문 미포함 (시스템 메타데이터 + 파일 경로만)

### 8.3 클라이언트 저장
- localStorage만 사용 (서버 미저장)
- 50건 캡 + QuotaExceeded 시 절반 삭제 후 재시도
- 사용자가 수동 삭제 가능 (개별/전체)

---

## 9. 비기능 요구사항

| 항목 | 목표 |
|---|---|
| `/diagnose` 응답 시간 | 5~30초 (Gemini 호출 단일) |
| `/scan` 응답 시간 | 작은 저장소 5~20초 / 대형 저장소 30~120초 (Gemini refine 9~15초 가산) |
| 동시 요청 | 단일 인스턴스, 큐 없음 (MVP) |
| 가용성 | 데모 환경 — SLA 없음 |
| 브라우저 지원 | 최신 Chromium / Safari / Firefox |
| 언어 | 한국어 (UI 100%, 응답 100%) |

---

## 10. 알려진 제약

1. **Regex 기반 분석기** — AST 미지원. import 별칭, 동적 호출 일부 누락.
2. **단일 커밋 스캔** — depth=1. 히스토리 기반 분석 불가.
3. **`AIBA-HIGH-COMPUTE` 자동 트리거 미구현** — FLOPS/파라미터 추정 없음.
4. **이력 저장은 브라우저 로컬** — 다른 기기/브라우저로 이동 시 새로 시작.
5. **Gemini refine 상한 10개 시스템** — 11번째 이후는 결정적 결과만.
6. **인증/권한 없음** — 단일 사용자 가정. 누구나 모든 페이지 접근.
7. **결과 영속화 없음 (서버)** — 새로고침해도 localStorage에 있으면 복원 가능, 없으면 손실.

---

## 11. 환경변수

| 변수 | 필수 | 용도 |
|---|---|---|
| `GEMINI_API_KEY` | `/diagnose` 필수, `/scan`은 옵션 | Google AI Studio API 키 |

`/scan`은 키 미설정 시에도 결정적 분석 결과는 정상 반환 (`refinement: null`).

---

## 12. 참조

- 본문 법령: [국가법령정보센터](https://www.law.go.kr/) (AI기본법 검색)
- 의무 정의 모듈: [src/lib/laws/ai-basic-act.ts](CMUX-HACKATHON/src/lib/laws/ai-basic-act.ts)
- 카탈로그 스키마: [src/lib/scan/catalog/schema.ts](CMUX-HACKATHON/src/lib/scan/catalog/schema.ts)
- 합성기 핵심 로직: [src/lib/scan/synthesizer/synthesize.ts](CMUX-HACKATHON/src/lib/scan/synthesizer/synthesize.ts)
- Gemini refine: [src/lib/gemini/refine-scan.ts](CMUX-HACKATHON/src/lib/gemini/refine-scan.ts)

---

> 본 명세서의 출력 결과는 **자동화된 추론**이며 법적 자문이 아닙니다. 실제 의무 이행 전 법무팀/외부 자문을 거치세요.
