/**
 * Set-based precision / recall / F1.
 *
 * 라벨된 expected vs 실제 actual 집합을 비교한다. 동일 키가 여러 번 나오면 1번으로 카운트.
 */
export interface PRF {
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  fn: number;
  expected: number;
  actual: number;
}

export function setPRF(expected: string[], actual: string[]): PRF {
  const exp = new Set(expected);
  const act = new Set(actual);
  let tp = 0;
  for (const x of act) if (exp.has(x)) tp++;
  const fp = act.size - tp;
  const fn = exp.size - tp;
  const precision = act.size === 0 ? (exp.size === 0 ? 1 : 0) : tp / act.size;
  const recall = exp.size === 0 ? 1 : tp / exp.size;
  const f1 =
    precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    precision,
    recall,
    f1,
    tp,
    fp,
    fn,
    expected: exp.size,
    actual: act.size,
  };
}

/** macro = 카테고리별 PRF의 단순 평균 (불균형 데이터에 좋음). */
export function macroPRF(rows: PRF[]): { precision: number; recall: number; f1: number } {
  if (rows.length === 0) return { precision: 0, recall: 0, f1: 0 };
  const sum = rows.reduce(
    (s, r) => ({
      precision: s.precision + r.precision,
      recall: s.recall + r.recall,
      f1: s.f1 + r.f1,
    }),
    { precision: 0, recall: 0, f1: 0 }
  );
  return {
    precision: sum.precision / rows.length,
    recall: sum.recall / rows.length,
    f1: sum.f1 / rows.length,
  };
}

export function fmt(n: number): string {
  return n.toFixed(3);
}

export function fmtPRF(p: PRF): string {
  return `P=${fmt(p.precision)} R=${fmt(p.recall)} F1=${fmt(p.f1)} (tp=${p.tp} fp=${p.fp} fn=${p.fn})`;
}
