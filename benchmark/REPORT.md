# LexOS 스캔 벤치마크 — 1차 결과

**생성**: 2026-04-26 17:01 KST · **호스트**: http://localhost:3000 · **샘플**: 10개 GitHub 레포

대시보드: [http://localhost:3000/benchmark/index.html](http://localhost:3000/benchmark/index.html)
Raw: [public/benchmark/results.json](../public/benchmark/results.json)

---

## 한눈에

| 지표 | 값 |
|---|---:|
| 평균 응답 시간 | **75.1 s** |
| 취약 레포 평균 적용 의무 | **4.2개** (test01 실패 제외시 5.25개) |
| 안전 레포 평균 적용 의무 | **3.4개** |
| RAG 인용 검증 통과율 | **42/42 = 100%** (성공한 9건 기준) |
| 환각 적발(`unsupportedRefs`) | **0건** |
| 리포트 생성 성공률 | **9/10** (test01 JSON truncation) |

---

## 레포별 결과

| # | 레포 | 분류 | 지연(s) | 시스템 | 적용 | 검증 | 환각 | 위험 | 비고 |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| 1 | CMUX-test01 — 신용 자동심사 | vuln | 104.2 | 6 | — | — | — | — | ⚠ JSON truncation |
| 2 | CMUX-test02 — 의료 영상 | vuln | 91.6 | 3 | 7 | 7 | 0 | high | ✓ |
| 3 | CMUX-test03 — 이미지 생성 (워터마크X) | vuln | 74.0 | 4 | 4 | 4 | 0 | high | ✓ |
| 4 | CMUX-test04 — 채용 스크리닝 | vuln | 80.7 | 5 | 6 | 6 | 0 | high | ✓ |
| 5 | CMUX-test05 — PII 파인튜닝 | vuln | 74.6 | 4 | 4 | 4 | 0 | high | ✓ |
| 6 | CMUX-test06 — 사내 요약 (HCX) | safe | 60.3 | 1 | 3 | 3 | 0 | medium | ✓ |
| 7 | CMUX-test07 — 전통 ML 추천 | safe | 91.5 | 3 | 7 | 7 | 0 | high | ⚠ over-flag |
| 8 | CMUX-test08 — 이미지 생성 (워터마크O) | safe | 77.8 | 3 | 4 | 4 | 0 | medium | ✓ |
| 9 | CMUX-test09 — FAQ 봇 (Solar) | safe | 65.1 | 2 | 3 | 3 | 0 | medium | ✓ |
| 10 | CMUX-test10 — AI 미사용 | safe | 30.7 | 0 | 0 | 0 | 0 | low | ✓ |

---

## 좋은 신호

1. **RAG 환각 차단이 작동했다** — 9개 성공 결과 중 `unsupportedRefs` 누적 0. 모델이 본문에 만들어낸 가짜 조문 번호가 없었음.
2. **인용 검증 통과율 100%** — Gemini가 의무별로 corpus 내 발췌를 그대로 인용해 substring 매칭에 성공. 시스템 프롬프트의 강제가 먹힘.
3. **취약-안전 구분 신호 분명** — 안전 그룹의 위험도 분포는 `low / medium / medium / medium / high(false)`로 위험도 레이블만 봐도 개인의 직관과 일치.
4. **응답 시간 안정** — 30~104초 범위, 분산 작음.

## 발견된 결함

### CRITICAL — 1번
- **test01 JSON truncation 실패**: Gemini 응답이 `maxOutputTokens: 16_000`을 넘겨 끝이 잘림 → JSON parse 실패 → reportError. 이전 리뷰에서 지목한 위험이 실제로 적중.
  - 수정 방향: (a) maxOutputTokens 상향, (b) obligationDeepDive를 의무 단위로 분할 호출, (c) 응답 미완 감지 시 재시도.

### MEDIUM — 2번 (false positive)
- **test07(전통 ML 추천)이 high 위험 + 의무 7개로 분류됨**: sklearn/xgboost는 비-생성, 비-고영향이라 의무 1~2개가 적정. 코드에 `pd.read_csv` + `score >` 임계치 패턴이 있어 `pattern.dataset_load` + `pattern.threshold_decision` 룰이 트리거된 것으로 추정.
  - 수정 방향: 임계치 룰을 코드 패턴이 아닌 도메인 결합 시에만 적용하도록 강화. 또는 `enriches.autonomy = "fully_automated"` 트리거 조건을 더 엄격히.

### LOW
- **test06(HCX 사내 요약)이 medium**: 한국 모델 + CLI 도구이지만 medium까지 올라감. `chatbot` 패턴이 살짝 매치됐을 가능성. 큰 문제 아님.

---

## 다음 액션

| 우선순위 | 작업 |
|---|---|
| P1 | `compliance-report.ts` JSON truncation 대응 (maxOutputTokens 24k or split) |
| P2 | `pattern.threshold_decision` 트리거 정밀화 (도메인 키워드 동반 시에만) |
| P3 | 같은 레포 3회 반복 스캔하여 결과 안정성(consistency) 측정 |
| P3 | 같은 레포 RAG on/off 비교 — 환각 차단 효과 정량화 |

---

> 본 결과는 단일 실행이며 통계적 유의성을 주장하지 않습니다. 모델 비결정성 때문에 수치는 ±10% 변동 가능.
