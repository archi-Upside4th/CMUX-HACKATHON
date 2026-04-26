# LexOS Benchmark Pack

이 폴더는 LexOS 리포트 품질을 반복 검증하기 위한 더미데이터 팩입니다.

핵심 파일:
- `lexos-aiba-benchmark.v1.ts`

포함 내용:
- 총 30개 시나리오
- `company_profile` 15개
- `scan_blueprint` 15개
- `good / mixed / poor` 포지션 혼합
- 입력 데이터와 기대 결과를 한 파일에 함께 보관

중요한 기준:
- 이 데이터셋은 현재 저장소가 사용하는 9개 의무 모델에 맞춰 작성됐습니다.
- 외부 법률 자문을 대체하지 않습니다.
- 특히 `scan_blueprint`는 실제 GitHub URL이 아니라, 스캐너가 봐야 하는 파일 신호를 압축한 테스트 사양입니다.

## 어떻게 쓰면 좋은가

`company_profile`:
1. `input.companyProfile`을 `/api/diagnose`에 넣습니다.
2. 결과의 `overallRisk`, 의무 집합, 요약/조치 문구를 `expected`와 비교합니다.

`scan_blueprint`:
1. `input.repositoryBlueprint`를 보고 미니 fixture repo를 만들거나,
2. 유사한 공개 저장소에 대해 결과를 비교하거나,
3. 내부 스캐너 단위테스트의 ground truth로 사용합니다.

## 권장 채점 방식

`company_profile` 100점:
- 20점: `overallRisk` 정확도
- 35점: 의무 매핑 F1
- 15점: `mustMention` 커버리지
- 15점: `shouldRecommend`의 구체성
- 10점: `shouldQuestion` 반영
- 5점: `mustNotClaim` 위반 없음

`scan_blueprint` 100점:
- 20점: 시스템 검출 F1
- 15점: `overallRisk` 정확도
- 30점: 의무 매핑 F1
- 10점: 서비스 맥락 추론 정확도
- 10점: `mustMention` 커버리지
- 10점: `shouldRecommend`의 구체성
- 5점: `shouldQuestion` 반영

## 점수 해석

- 90점 이상: 데모/투자자 대상 품질 확인 가능
- 80점 이상: MVP 기준 양호, 회귀테스트 추천
- 70점 이상: 핵심 기능은 동작하지만 리포트 일관성 보완 필요
- 70점 미만: 리스크/의무 매핑 또는 서술 품질에 구조적 수정 필요

## 리뷰할 때 특히 볼 것

- 좋은 사례를 과도하게 위험하게 쓰지 않는지
- 고영향 사례에서 `영향평가`, `고지`, `인간 개입`을 빠뜨리지 않는지
- 생성형 이미지 사례에서 `워터마크`를 다루는지
- 파인튜닝 사례에서 `데이터 거버넌스`를 짚는지
- 실제 신호가 없는 의무를 함부로 단정하지 않는지
