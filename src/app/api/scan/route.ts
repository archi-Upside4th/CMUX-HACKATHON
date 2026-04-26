import { NextRequest } from "next/server";
import { z } from "zod";
import { collectRepo } from "@/lib/scan/collector/collector";
import { analyzeRepo } from "@/lib/scan/analyzer/analyze";
import { synthesizeSystems } from "@/lib/scan/synthesizer/synthesize";
import { refineScan, type ScanRefinement } from "@/lib/gemini/refine-scan";
import { collectRepoContext } from "@/lib/scan/context/collect-context";
import { inferServiceProfile } from "@/lib/gemini/service-profile";
import { buildComplianceReport } from "@/lib/gemini/compliance-report";
import type {
  ServiceProfile,
  ComplianceReport,
  RepoContext,
} from "@/lib/report/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const RequestSchema = z.object({
  repoUrl: z.string().url(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 파싱 실패" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "입력 검증 실패", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const collected = await collectRepo(parsed.data.repoUrl, {
    timeoutMs: 90_000,
    maxFiles: 5000,
  });
  if (!collected.ok) {
    return Response.json(
      { error: "수집 실패", reason: collected.reason, stderr: collected.stderr },
      { status: 400 }
    );
  }

  try {
    const report = await analyzeRepo(collected);
    const { systems, unattributedFindings } = await synthesizeSystems(report);

    // Gemini refine (legacy per-system) — 키 없거나 실패해도 결정적 결과는 정상 반환
    let refinement: ScanRefinement | null = null;
    let refineError: string | null = null;
    if (process.env.GEMINI_API_KEY) {
      try {
        refinement = await refineScan({
          repoUrl: collected.normalizedUrl,
          systems,
          unattributedRuleIds: unattributedFindings
            .map((f) => f.ruleId)
            .filter((r): r is string => Boolean(r)),
          languageStats: report.fileTree.languageStats,
        });
      } catch (e) {
        refineError = e instanceof Error ? e.message : String(e);
        console.error("[scan refine]", refineError);
      }
    }

    // 서비스-레벨 컴플라이언스 리포트 (Step B + C)
    const repoContext: RepoContext = await collectRepoContext(
      collected,
      systems
    );
    let serviceProfile: ServiceProfile | null = null;
    let complianceReport: ComplianceReport | null = null;
    let reportError: string | null = null;
    if (process.env.GEMINI_API_KEY) {
      try {
        serviceProfile = await inferServiceProfile({
          repoUrl: collected.normalizedUrl,
          context: repoContext,
          systems,
        });
        complianceReport = await buildComplianceReport({
          repoUrl: collected.normalizedUrl,
          serviceProfile,
          systems,
          context: repoContext,
        });
      } catch (e) {
        reportError = e instanceof Error ? e.message : String(e);
        console.error("[scan report]", reportError);
      }
    }

    const REPORT_SYSTEM_LIMIT = 15;
    const truncatedSystems =
      complianceReport && systems.length > REPORT_SYSTEM_LIMIT
        ? systems.length - REPORT_SYSTEM_LIMIT
        : 0;

    return Response.json({
      ok: true,
      repoUrl: collected.normalizedUrl,
      commitSha: collected.commitSha,
      stats: {
        totalFiles: report.fileTree.totalFiles,
        languageStats: report.fileTree.languageStats,
        totalFindings: report.findings.length,
      },
      systems,
      unattributedFindings: unattributedFindings.slice(0, 50),
      refinement,
      refineError,
      serviceProfile,
      report: complianceReport,
      reportError,
      truncatedSystems,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[scan]", msg);
    return Response.json({ error: "분석 실패", detail: msg }, { status: 500 });
  } finally {
    await collected.cleanup().catch((err) => {
      console.error("[scan cleanup]", err);
    });
  }
}
