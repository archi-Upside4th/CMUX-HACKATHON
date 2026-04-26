import { NextRequest } from "next/server";
import { z } from "zod";
import { collectRepo } from "@/lib/scan/collector/collector";
import { analyzeRepo } from "@/lib/scan/analyzer/analyze";
import { synthesizeSystems } from "@/lib/scan/synthesizer/synthesize";

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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[scan]", msg);
    return Response.json({ error: "분석 실패", detail: msg }, { status: 500 });
  } finally {
    await collected.cleanup().catch(() => {});
  }
}
