#!/usr/bin/env node
/**
 * LexOS scan benchmark — 10 repo URLs를 순차 스캔하고 결과를 benchmark/results.json에 저장.
 *
 * 측정:
 *  - latencyMs: /api/scan 왕복 시간
 *  - systems: 검출된 AI 시스템 수
 *  - obligationsApplicable: 적용/조건부 의무 수
 *  - obligationsVerified: RAG 검증 통과 의무 수
 *  - hallucinationCount: unsupportedRefs 합계
 *  - p1Urgent: 30일 내 액션 수
 *  - overallRisk
 *  - reportError / refineError
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.LEXOS_HOST ?? "http://localhost:3000";

const REPOS = [
  { url: "https://github.com/archi-Upside4th/CMUX-test01", expected: "vuln", label: "신용 자동심사" },
  { url: "https://github.com/archi-Upside4th/CMUX-test02", expected: "vuln", label: "의료 영상" },
  { url: "https://github.com/archi-Upside4th/CMUX-test03", expected: "vuln", label: "이미지 생성 (워터마크X)" },
  { url: "https://github.com/archi-Upside4th/CMUX-test04", expected: "vuln", label: "채용 스크리닝" },
  { url: "https://github.com/archi-Upside4th/CMUX-test05", expected: "vuln", label: "PII 파인튜닝" },
  { url: "https://github.com/archi-Upside4th/CMUX-test06", expected: "safe", label: "사내 요약 (HCX)" },
  { url: "https://github.com/archi-Upside4th/CMUX-test07", expected: "safe", label: "전통 ML 추천" },
  { url: "https://github.com/archi-Upside4th/CMUX-test08", expected: "safe", label: "이미지 생성 (워터마크O)" },
  { url: "https://github.com/archi-Upside4th/CMUX-test09", expected: "safe", label: "FAQ 봇 (Solar)" },
  { url: "https://github.com/archi-Upside4th/CMUX-test10", expected: "safe", label: "AI 미사용" },
];

async function scanOne(repoUrl) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl }),
  });
  const latencyMs = Date.now() - t0;
  const data = await res.json();
  return { latencyMs, status: res.status, data };
}

function summarize(repo, scan) {
  const data = scan.data ?? {};
  const systems = Array.isArray(data.systems) ? data.systems.length : 0;
  const dd = data.report?.obligationDeepDive ?? [];
  const applicable = dd.filter((o) => o.applicability !== "not_applicable");
  const verified = applicable.filter((o) => o.verified);
  const hallucinationCount = dd.reduce(
    (sum, o) => sum + (o.unsupportedRefs?.length ?? 0),
    0
  );
  const triggeredObligations = applicable.map((o) => o.obligationId);
  return {
    repo: repo.url.split("/").pop(),
    label: repo.label,
    expected: repo.expected,
    httpStatus: scan.status,
    latencyMs: scan.latencyMs,
    overallRisk: data.report?.overallRisk ?? null,
    systems,
    obligationsApplicable: applicable.length,
    obligationsVerified: verified.length,
    verificationRate: applicable.length
      ? +(verified.length / applicable.length).toFixed(3)
      : null,
    hallucinationCount,
    triggeredObligations,
    p1Urgent: data.report?.roadmap?.p1_urgent?.length ?? 0,
    truncatedSystems: data.truncatedSystems ?? 0,
    refineError: data.refineError ?? null,
    reportError: data.reportError ?? null,
    error: data.error ?? null,
  };
}

function flush(results, finished) {
  const out = {
    generatedAt: new Date().toISOString(),
    host: BASE,
    finished,
    total: REPOS.length,
    results,
  };
  for (const dir of ["benchmark", "public/benchmark"]) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "results.json"), JSON.stringify(out, null, 2));
  }
}

async function main() {
  const results = [];
  flush(results, false);
  for (let i = 0; i < REPOS.length; i++) {
    const repo = REPOS[i];
    const tag = `[${i + 1}/${REPOS.length}] ${repo.url.split("/").pop()} (${repo.expected})`;
    process.stdout.write(`${tag} … `);
    try {
      const scan = await scanOne(repo.url);
      const row = summarize(repo, scan);
      results.push(row);
      console.log(
        `${row.latencyMs}ms · systems=${row.systems} · applicable=${row.obligationsApplicable} · verified=${row.obligationsVerified} · halluc=${row.hallucinationCount} · risk=${row.overallRisk ?? "-"}`
      );
    } catch (e) {
      console.log(`FAIL ${e?.message ?? e}`);
      results.push({
        repo: repo.url.split("/").pop(),
        label: repo.label,
        expected: repo.expected,
        error: e?.message ?? String(e),
      });
    }
    flush(results, results.length === REPOS.length);
  }
  console.log(
    `\nwrote benchmark/results.json + public/benchmark/results.json (${results.length} rows)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
