/**
 * L1 Fixture Suite — Layer B (코드 합성) + Layer C (Profile 머지) 회귀 검사.
 *
 * 각 fixture 디렉토리:
 *   files/         실제 mini repo
 *   expected.json  검증 기준
 *   profile.json   (선택) Service Profile Intake — 있으면 머지 검증 추가
 *
 * 측정:
 *   - Layer B (코드만): systems / obligations precision/recall + forbidden 위반
 *   - Layer C (머지):   expectedMergedRequired set match + 모순 종류 일치
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, readFile, stat } from "node:fs/promises";
import { describe, it, expect } from "vitest";
import { analyzeRepo } from "@/lib/scan/analyzer/analyze";
import { synthesizeSystems } from "@/lib/scan/synthesizer/synthesize";
import { mergeProfileAndCode } from "@/lib/scan/profile/merge";
import { ServiceProfileIntakeSchema } from "@/lib/scan/profile/schema";
import { loadFixture } from "./fake-collected";
import { setPRF, macroPRF, fmtPRF, fmt } from "./metrics";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = path.join(HERE, "fixtures");

interface ExpectedSpec {
  description: string;
  expectedSystems: Array<{
    catalogEntryId: string;
    modelProviderContains?: string;
    isForeignModel?: boolean;
  }>;
  expectedObligations: string[];
  forbiddenObligations: string[];
  // Layer C 머지 검증 (선택)
  expectedMergedRequired?: string[];
  expectedContradictionKinds?: string[];
}

interface FixtureResult {
  slug: string;
  expected: ExpectedSpec;
  systems: ReturnType<typeof setPRF>;
  obligations: ReturnType<typeof setPRF>;
  forbiddenViolations: string[];
  detectedSystems: Array<{
    catalogEntryId: string;
    modelProvider: string;
    isForeignModel: boolean;
    triggeredObligations: string[];
  }>;
  mergedRequired?: ReturnType<typeof setPRF>;
  contradictionMatch?: { expected: string[]; actual: string[]; ok: boolean };
}

async function listFixtures(): Promise<string[]> {
  const entries = await readdir(FIXTURE_ROOT, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function runFixture(slug: string): Promise<FixtureResult> {
  const expectedPath = path.join(FIXTURE_ROOT, slug, "expected.json");
  const profilePath = path.join(FIXTURE_ROOT, slug, "profile.json");
  const expected: ExpectedSpec = JSON.parse(
    await readFile(expectedPath, "utf8")
  );

  const collected = await loadFixture(slug);
  const report = await analyzeRepo(collected);
  const { systems } = await synthesizeSystems(report);

  const detectedCatalogIds = systems.map((s) => s.catalogEntryId);
  const expectedCatalogIds = expected.expectedSystems.map(
    (s) => s.catalogEntryId
  );

  const detectedObligations: string[] = [
    ...new Set(systems.flatMap((s) => s.triggeredObligations as string[])),
  ];

  const forbiddenViolations = expected.forbiddenObligations.filter((o) =>
    detectedObligations.includes(o)
  );

  // Layer C 머지 (profile.json이 있을 때만)
  let mergedRequired: ReturnType<typeof setPRF> | undefined;
  let contradictionMatch: FixtureResult["contradictionMatch"];
  if (await fileExists(profilePath)) {
    const profileRaw = JSON.parse(await readFile(profilePath, "utf8"));
    const profile = ServiceProfileIntakeSchema.parse(profileRaw);
    const merged = mergeProfileAndCode(systems, profile);

    const actualRequired = merged.mergedObligations
      .filter((m) => m.status === "REQUIRED")
      .map((m) => m.obligationId);
    if (expected.expectedMergedRequired) {
      mergedRequired = setPRF(expected.expectedMergedRequired, actualRequired);
    }

    const actualKinds = merged.contradictions.map((c) => c.kind).sort();
    const expectedKinds = (expected.expectedContradictionKinds ?? [])
      .slice()
      .sort();
    contradictionMatch = {
      expected: expectedKinds,
      actual: actualKinds,
      ok: JSON.stringify(actualKinds) === JSON.stringify(expectedKinds),
    };
  }

  return {
    slug,
    expected,
    systems: setPRF(expectedCatalogIds, detectedCatalogIds),
    obligations: setPRF(expected.expectedObligations, detectedObligations),
    forbiddenViolations,
    detectedSystems: systems.map((s) => ({
      catalogEntryId: s.catalogEntryId,
      modelProvider: s.modelProvider,
      isForeignModel: s.isForeignModel,
      triggeredObligations: s.triggeredObligations,
    })),
    mergedRequired,
    contradictionMatch,
  };
}

describe("L1 fixture suite — synthesizer + profile merge 정확성", async () => {
  const slugs = await listFixtures();
  const results: FixtureResult[] = [];

  for (const slug of slugs) {
    it(slug, async () => {
      const r = await runFixture(slug);
      results.push(r);

      // === Layer B 임계치 ===
      expect(
        r.forbiddenViolations,
        `금지된 의무 트리거됨: ${r.forbiddenViolations.join(", ")}`
      ).toEqual([]);

      if (r.expected.expectedSystems.length > 0) {
        expect(
          r.systems.recall,
          `systems recall 너무 낮음`
        ).toBeGreaterThanOrEqual(0.8);
        expect(
          r.systems.precision,
          `systems precision 너무 낮음`
        ).toBeGreaterThanOrEqual(0.85);
      } else {
        expect(
          r.detectedSystems,
          `AI 없는 fixture에서 시스템 검출됨`
        ).toEqual([]);
      }

      if (r.expected.expectedObligations.length > 0) {
        expect(
          r.obligations.recall,
          `obligations recall 너무 낮음`
        ).toBeGreaterThanOrEqual(0.8);
        expect(
          r.obligations.precision,
          `obligations precision 너무 낮음`
        ).toBeGreaterThanOrEqual(0.7);
      }

      // === Layer C 임계치 (profile.json 존재 시) ===
      if (r.mergedRequired && r.expected.expectedMergedRequired) {
        if (r.expected.expectedMergedRequired.length > 0) {
          expect(
            r.mergedRequired.recall,
            `merged REQUIRED recall 너무 낮음`
          ).toBeGreaterThanOrEqual(0.8);
          expect(
            r.mergedRequired.precision,
            `merged REQUIRED precision 너무 낮음`
          ).toBeGreaterThanOrEqual(0.7);
        } else {
          // expectedMergedRequired가 빈 배열이면 actual도 비어야 함 (no-AI short-circuit 검증)
          expect(
            r.mergedRequired.actual,
            `AI 미감지 fixture에서 REQUIRED 의무가 발동됨`
          ).toEqual(0);
        }
      }
      if (r.contradictionMatch) {
        expect(
          r.contradictionMatch.ok,
          `contradiction kinds 불일치 — expected ${JSON.stringify(
            r.contradictionMatch.expected
          )}, got ${JSON.stringify(r.contradictionMatch.actual)}`
        ).toBe(true);
      }
    });
  }

  it("📊 종합 메트릭 (참고용 — 실패 아님)", () => {
    if (results.length === 0) {
      console.log("결과 없음");
      return;
    }
    const sysMacro = macroPRF(results.map((r) => r.systems));
    const oblMacro = macroPRF(results.map((r) => r.obligations));
    const mergedRows = results
      .map((r) => r.mergedRequired)
      .filter((m): m is ReturnType<typeof setPRF> => m !== undefined);
    const mergedMacro = mergedRows.length > 0 ? macroPRF(mergedRows) : null;

    console.log("\n========== L1 Fixture Suite Metrics ==========");
    console.log(`총 fixture: ${results.length}`);
    console.log("\n[per-fixture]");
    for (const r of results) {
      console.log(`\n  ▶ ${r.slug}`);
      console.log(`     systems     ${fmtPRF(r.systems)}`);
      console.log(`     obligations ${fmtPRF(r.obligations)}`);
      if (r.mergedRequired) {
        console.log(`     merged      ${fmtPRF(r.mergedRequired)}`);
      }
      if (r.contradictionMatch) {
        const tag = r.contradictionMatch.ok ? "✅" : "❌";
        console.log(
          `     contrad ${tag}  expected=[${r.contradictionMatch.expected.join(",")}] actual=[${r.contradictionMatch.actual.join(",")}]`
        );
      }
      if (r.forbiddenViolations.length > 0) {
        console.log(
          `     ⚠ forbidden 위반: ${r.forbiddenViolations.join(", ")}`
        );
      }
      console.log(
        `     detected    [${r.detectedSystems
          .map((s) => `${s.catalogEntryId}/${s.modelProvider}`)
          .join(", ")}]`
      );
    }
    console.log("\n[macro 평균]");
    console.log(
      `  systems     P=${fmt(sysMacro.precision)} R=${fmt(sysMacro.recall)} F1=${fmt(sysMacro.f1)}`
    );
    console.log(
      `  obligations P=${fmt(oblMacro.precision)} R=${fmt(oblMacro.recall)} F1=${fmt(oblMacro.f1)}`
    );
    if (mergedMacro) {
      console.log(
        `  merged REQ  P=${fmt(mergedMacro.precision)} R=${fmt(mergedMacro.recall)} F1=${fmt(mergedMacro.f1)}`
      );
    }
    console.log("==============================================\n");
  });
});
