# LexOS — AI기본법 컴플라이언스 자동화

> 한국 AI기본법(2026.1.22 시행)의 9개 의무를, **회사 프로필** 또는 **GitHub 저장소 URL** 한 줄로 자동 매핑하는 B2B SaaS MVP.

법무팀이 일일이 체크리스트를 돌리는 대신, LexOS가 ① 코드를 정적 분석해서 어떤 AI 시스템을 쓰는지 식별하고 ② 위험등급(high/medium/low)을 결정하고 ③ 트리거되는 의무를 자동으로 붙여줍니다.

---

## 빠른 시작

### 0. 사전 요구사항
- Node.js 20+ (개발은 Node 25 + Turbopack)
- `git` (저장소 스캔용 — 시스템 git 바이너리 사용)
- Gemini API 키 (회사 프로필 진단에 사용)

### 1. 설치 & 실행
```bash
git clone git@github.com:archi-Upside4th/CMUX-HACKATHON.git
cd CMUX-HACKATHON
npm install

# 환경변수
cat > .env <<'EOF'
GEMINI_API_KEY=<발급받은_키>
EOF

npm run dev
# → http://localhost:3000
```

### 2. 첫 사용
`http://localhost:3000/dashboard`로 접속하면 두 진입점(스캔 / 진단) 카드 + 최근 이력이 한눈에 보입니다. 상단 네비에서 언제든 이동 가능.

- **대시보드** — `/dashboard` — 최근 스캔/진단 이력 + 빠른 진입
- **회사 프로필 진단** — `/` — 폼에 회사 정보 입력 (Gemini 기반)
- **코드 스캔** — `/scan` — GitHub URL 한 줄 입력 (정적 분석 + Gemini 서술 보강)

---

## 세 가지 진입점

### A. `/dashboard` — 대시보드
- 최근 스캔/진단 이력 (브라우저 localStorage 저장 — 최신 50건)
- KPI: 총 이력 / 스캔 수 / 진단 수 / HIGH 위험 건수
- 카드 클릭 → 저장된 결과 그대로 재표시 (`/dashboard/{id}`)
- 필터: 전체 / 스캔 / 진단

> 저장은 브라우저 로컬에서만. 다른 기기/브라우저와 공유 안 됨. 추후 DB 백엔드 추가 예정.

### B. `/` — 회사 프로필 진단 (Gemini 기반)
회사가 어떤 AI를 어떻게 쓰는지 자연어로 입력하면 Gemini 2.5 Flash가 의무를 매핑합니다.

- **입력**: 회사명, 산업, AI 사용 목적, 모델 종류, 데이터 종류 등 (폼 항목)
- **출력**: 9개 의무별 적용 여부 + 근거 + 권장 액션
- **API**: `POST /api/diagnose` — 본문 스키마는 `src/lib/types.ts`의 `CompanyProfileSchema` 참조

### C. `/scan` — GitHub 저장소 코드 스캔 (정적 분석 + Gemini 서술)
저장소 URL만 주면 자동 스캔 → AI 시스템 식별 → 의무 매핑 → Gemini가 비기술자용 서술 보강.

#### 사용법
1. `/scan` 페이지에서 GitHub URL 입력 (예: `https://github.com/openai/openai-quickstart-python`)
2. "코드 스캔 실행" 클릭
3. 결과: 검출된 AI 시스템 카드 + 위험등급 + 트리거된 의무 + 근거 파일

#### 허용되는 URL
- `https://` 스킴만 (ssh URL 거부)
- 호스트 화이트리스트: `github.com`, `gitlab.com`, `bitbucket.org`, `codeberg.org`
- 깊이 1 클론, 단일 blob ≤ 10MB

#### 응답 (`POST /api/scan` JSON)
```jsonc
{
  "ok": true,
  "repoUrl": "https://github.com/...",
  "commitSha": "ec8890d101bd...",
  "stats": {
    "totalFiles": 7,
    "languageStats": {"python": 5, "typescript": 2},
    "totalFindings": 12
  },
  "systems": [
    {
      "id": "synth-ab12cd34ef",
      "catalogEntryId": "py.openai",
      "name": "OpenAI Python SDK (gpt-4o)",
      "purpose": "chat 모듈에서 OpenAI Python SDK 사용",
      "procurement": "third_party_api",
      "modelProvider": "OpenAI",
      "modelName": "gpt-4o",
      "isForeignModel": true,
      "domains": ["general"],
      "modalities": ["text"],
      "isGenerative": true,
      "trainsOrFineTunes": false,
      "derivedRiskTier": "medium",
      "triggeredObligations": [
        "AIBA-NOTICE", "AIBA-RISK-MGMT", "AIBA-FOREIGN-REP"
      ],
      "confidence": "high",
      "evidence": {
        "catalogEntryIds": ["py.openai"],
        "ruleIds": [],
        "filePaths": ["src/chat.py", "requirements.txt"]
      }
    }
  ],
  "unattributedFindings": [
    { "ruleId": "pattern.threshold_decision", "filePath": "...", "lineStart": 42 }
  ],
  "refinement": {
    "overallSummary": "이 저장소는 OpenAI 외부 LLM에 의존하는 ...",
    "topPriority": "synth-ab12cd34ef (OpenAI Python SDK) — 외부 생성형 AI ...",
    "systems": [
      {
        "systemId": "synth-ab12cd34ef",
        "humanSummary": "이 시스템은 사용자 질문에 자연어로 답하는 챗봇 ...",
        "riskNarrative": "외부 OpenAI 모델을 사용하므로 ... 부정확/편향 답변 시 분쟁 가능.",
        "mitigations": ["AI 사용 사실을 이용자에게 명확히 고지하십시오 ...", "..."],
        "priorityScore": 2,
        "gaps": ["워터마크 적용 여부 확인 필요", "..."]
      }
    ]
  },
  "refineError": null
}
```

> `refinement`는 `GEMINI_API_KEY`가 설정된 경우에만 채워집니다. 키가 없거나 호출 실패 시 `null`이며 결정적 결과(`systems`)는 그대로 반환됩니다.

---

## 결과 해석

### 위험등급 (`derivedRiskTier`)
| 등급 | 트리거 조건 | 의미 |
|---|---|---|
| `high` | 고영향 도메인 + (완전자동 또는 비생성형) | 영향평가/공시 의무 추가 |
| `medium` | 생성형 AI | 고지/위험관리/(해외 시) 대리인 |
| `low` | 그 외 | 위험관리만 |

**고영향 도메인**: `credit_finance`, `employment`, `healthcare`, `biometric_id`, `law_enforcement`

### 9개 의무 (`triggeredObligations`)
| ID | 한국어 | 자동 트리거 시점 |
|---|---|---|
| `AIBA-NOTICE` | AI 사용 고지 | 모든 생성형 AI |
| `AIBA-RISK-MGMT` | 위험관리체계 구축 | 모든 시스템 |
| `AIBA-FOREIGN-REP` | 국내 대리인 지정 | `isForeignModel: true` 시 |
| `AIBA-WATERMARK` | 생성물 워터마크 | 이미지 생성 호출 검출 시 |
| `AIBA-DATA-GOVERNANCE` | 학습데이터 거버넌스 | 학습/파인튜닝 코드 검출 시 (PEFT/TRL/Accelerate 등) |
| `AIBA-HIGH-IMPACT` | 고영향 AI 등록 | high tier 도달 시 |
| `AIBA-IMPACT-ASSESSMENT` | 영향평가 수행 | high tier 도달 시 |
| `AIBA-PUBLIC-DISCLOSURE` | 공개공시 | high tier 도달 시 |
| `AIBA-HIGH-COMPUTE` | 대규모 컴퓨팅 신고 | (현재 자동 트리거 없음, 카탈로그에서 수동 표시) |

상세는 [src/lib/laws/ai-basic-act.ts](src/lib/laws/ai-basic-act.ts) 참조.

### 신뢰도 (`confidence`)
- `high` — 매니페스트 의존성 + import + 실제 호출 모두 일치
- `medium` — import만 있고 호출 없음, 또는 매니페스트만 있음
- `low` — 단순 의존성 선언만 (dead code 가능성)

### `isForeignModel` 자동 보정
한국 모델 prefix는 자동으로 `false`로 보정됩니다 → `AIBA-FOREIGN-REP` 미적용.
- `upstage/`, `solar-`, `lgai-exaone/`, `exaone-`, `naver/`, `kt-`, `hcx-`

---

## 카탈로그 — 40개 라이브러리 커버

`src/lib/scan/catalog/entries/` 아래 YAML로 외부화. 빌드 시 Zod 검증.

### 현재 커버
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

### 새 엔트리 추가
1. `src/lib/scan/catalog/entries/<eco>/<name>.yaml` 생성
2. 스키마: [src/lib/scan/catalog/schema.ts](src/lib/scan/catalog/schema.ts)의 `CatalogEntrySchema`
3. 필수 필드: `id` (`{eco}.{name}` 형식), `name`, `nameKo`, `category`, `patterns`, `inferences`, `confidence`, `descriptionKo`, `addedAt`
4. 서버 재시작 (모듈 캐시 갱신)

예시는 [src/lib/scan/catalog/entries/python/openai.yaml](src/lib/scan/catalog/entries/python/openai.yaml) 참조.

### 코드 패턴 룰 (12개)
카탈로그와 별개로 `src/lib/scan/rules/code-patterns.ts`에 정의된 패턴 룰. 도메인 키워드(credit/HR/medical), 파인튜닝 루프, 임계치 결정, 워터마크 누락 등을 검출해 추가 의무를 트리거.

---

## 보안 모델

저장소 스캔은 임의의 외부 코드를 다루므로 다음 방어막을 적용:

- **호스트 화이트리스트** (`src/lib/scan/collector/sandbox.ts`): github/gitlab/bitbucket/codeberg만 허용. 다른 호스트는 즉시 거부.
- **owner/repo 정규식 검증**: `^[A-Za-z0-9._-]+$`
- **격리된 임시 디렉토리** (`mkdtemp`): 스캔 후 항상 cleanup. 부모 파일시스템 접근 불가.
- **git 보안 옵션**:
  - `core.hooksPath=/dev/null` — 클론 시 hooks 자동 실행 차단
  - `protocol.file.allow=never` — file:// 서브모듈 차단
  - `--filter=blob:limit=10m` — 큰 blob 클론 안 함
  - `--depth=1 --no-tags --single-branch`
- **심볼릭 링크 거부**: 워크 도중 심링크 발견 시 스킵
- **제외 디렉토리**: `node_modules`, `vendor`, `.venv`, `dist`, `build` 등은 처음부터 무시
- **테스트 파일 신호 강등**: `**/test/**`, `**/tests/**`, `*.test.*`, `*.spec.*`는 별도 분류 → 시스템 검출 가중치 낮춤

스캔 결과는 디스크에 저장하지 않습니다 (현재 MVP). API 응답으로만 반환.

---

## 환경변수

| 변수 | 필수 | 용도 |
|---|---|---|
| `GEMINI_API_KEY` | `/diagnose` 필수, `/scan`에선 옵션 | Google AI Studio API 키 |

`/scan`은 키가 없어도 결정적 분석 결과는 반환합니다 (Gemini 서술 보강만 생략, `refinement: null`).

---

## 알려진 제약

- **Regex 기반 분석기** — AST 분석 미지원. import 별칭 / 동적 호출 일부 누락. (Phase 1.5.6 tree-sitter 통합 예정)
- **`AIBA-HIGH-COMPUTE` 자동 트리거 미구현** — FLOPS/파라미터 수 추정 로직이 없어 카탈로그 명시 시에만 활성화.
- **단일 커밋 스캔** — depth=1. 히스토리 기반 분석 (예: 시간에 따른 위험 변화) 불가.
- **이력 저장은 브라우저 로컬** — `/dashboard`의 이력은 localStorage에만 보존. 다른 기기/브라우저로 이동 시 새로 시작. 50건 초과 시 오래된 항목 자동 폐기.
- **Gemini refine은 상위 10개 시스템만** — 토큰 절약을 위해 11번째 이후 시스템은 결정적 결과만 노출.

---

## 파일 구조

```
src/
├── app/
│   ├── api/
│   │   ├── diagnose/route.ts    # POST 회사 프로필 진단
│   │   └── scan/route.ts        # POST 코드 스캔 (synthesizer + Gemini refine)
│   ├── page.tsx                 # / — 회사 프로필 폼
│   ├── scan/page.tsx            # /scan — 코드 스캔 UI (refinement 카드)
│   ├── dashboard/page.tsx       # /dashboard — 이력 카드 + KPI
│   ├── dashboard/[id]/page.tsx  # /dashboard/{id} — 저장된 결과 재표시
│   └── layout.tsx               # 상단 네비 (대시보드/스캔/진단)
└── lib/
    ├── gemini/
    │   ├── client.ts            # GoogleGenAI 래퍼
    │   ├── diagnose.ts          # /diagnose 프롬프트
    │   └── refine-scan.ts       # /scan용 Gemini 서술 보강 (humanSummary/risk/mitigations/priority/gaps)
    ├── laws/ai-basic-act.ts     # 9개 의무 정의 (한국어)
    ├── storage/history.ts       # localStorage 이력 저장 추상화
    ├── types.ts                 # CompanyProfile Zod 스키마
    └── scan/
        ├── catalog/             # 40개 YAML 엔트리 + loader
        ├── collector/           # 샌드박스 git clone
        ├── analyzer/            # manifest + source + glob 분석
        ├── rules/code-patterns.ts  # 12개 코드 패턴 룰
        ├── inputs/finding.ts    # Finding/ScanReport 스키마
        └── synthesizer/         # 그룹화 + 머지 + 위험등급 + 의무 매핑
```

---

## 라이센스 / 면책

본 도구의 출력은 **자동화된 추론**이며 법적 자문이 아닙니다. 실제 의무 이행 전 법무팀/외부 자문을 거치세요. AI기본법 본문은 [국가법령정보센터](https://www.law.go.kr/)에서 확인.
