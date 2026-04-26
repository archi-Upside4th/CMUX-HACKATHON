import { NextRequest } from "next/server";
import { z } from "zod";
import { collectSource } from "@/lib/scan/collector/source";
import { analyzeRepo } from "@/lib/scan/analyzer/analyze";
import { synthesizeSystems } from "@/lib/scan/synthesizer/synthesize";
import { refineScan, type ScanRefinement } from "@/lib/gemini/refine-scan";
import { collectRepoContext } from "@/lib/scan/context/collect-context";
import { inferServiceProfile } from "@/lib/gemini/service-profile";
import { buildComplianceReport } from "@/lib/gemini/compliance-report";
import {
  ServiceProfileIntakeSchema,
  type ServiceProfileIntake,
} from "@/lib/scan/profile/schema";
import { mergeProfileAndCode } from "@/lib/scan/profile/merge";
import type {
  ServiceProfile,
  ComplianceReport,
  RepoContext,
} from "@/lib/report/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

// ──────────────────────────────────────────────────────────
// 입력 파싱 — JSON (git URL) 또는 multipart (zip + profile)
// ──────────────────────────────────────────────────────────

const JsonRequestSchema = z.object({
  repoUrl: z.string().url(),
  /** Layer A — Service Profile Intake. 선택사항. 없으면 코드만으로 판정. */
  profile: ServiceProfileIntakeSchema.optional(),
});

type ParsedRequest =
  | {
      kind: "git";
      url: string;
      profile: ServiceProfileIntake | null;
    }
  | {
      kind: "zip";
      buffer: Buffer;
      filename: string;
      profile: ServiceProfileIntake | null;
    }
  | { kind: "error"; status: number; body: object };

async function parseRequest(req: NextRequest): Promise<ParsedRequest> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch (e) {
      return {
        kind: "error",
        status: 400,
        body: {
          error: "multipart 파싱 실패",
          detail: e instanceof Error ? e.message : String(e),
        },
      };
    }
    const file = form.get("zip");
    const profileRaw = form.get("profile");
    const repoUrl = form.get("repoUrl");

    let profile: ServiceProfileIntake | null = null;
    if (typeof profileRaw === "string" && profileRaw.length > 0) {
      try {
        const parsed = ServiceProfileIntakeSchema.safeParse(
          JSON.parse(profileRaw)
        );
        if (!parsed.success) {
          return {
            kind: "error",
            status: 400,
            body: {
              error: "profile 검증 실패",
              issues: parsed.error.flatten(),
            },
          };
        }
        profile = parsed.data;
      } catch (e) {
        return {
          kind: "error",
          status: 400,
          body: {
            error: "profile JSON 파싱 실패",
            detail: e instanceof Error ? e.message : String(e),
          },
        };
      }
    }

    if (file instanceof File) {
      if (file.size > 100 * 1024 * 1024) {
        return {
          kind: "error",
          status: 413,
          body: { error: "ZIP 100MB 초과" },
        };
      }
      const buf = Buffer.from(await file.arrayBuffer());
      return {
        kind: "zip",
        buffer: buf,
        filename: file.name,
        profile,
      };
    }

    if (typeof repoUrl === "string" && repoUrl.length > 0) {
      return { kind: "git", url: repoUrl, profile };
    }

    return {
      kind: "error",
      status: 400,
      body: { error: "zip 또는 repoUrl 중 하나는 필수" },
    };
  }

  // JSON 모드
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      kind: "error",
      status: 400,
      body: { error: "JSON 파싱 실패" },
    };
  }
  const parsed = JsonRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      kind: "error",
      status: 400,
      body: { error: "입력 검증 실패", issues: parsed.error.flatten() },
    };
  }
  return {
    kind: "git",
    url: parsed.data.repoUrl,
    profile: parsed.data.profile ?? null,
  };
}

// ──────────────────────────────────────────────────────────
// POST
// ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const parsed = await parseRequest(req);
  if (parsed.kind === "error") {
    return Response.json(parsed.body, { status: parsed.status });
  }

  const collected =
    parsed.kind === "git"
      ? await collectSource({
          kind: "git",
          url: parsed.url,
          timeoutMs: 90_000,
          maxFiles: 5000,
        })
      : await collectSource({
          kind: "zip",
          buffer: parsed.buffer,
          filename: parsed.filename,
        });

  if (!collected.ok) {
    return Response.json(
      {
        error: "수집 실패",
        reason: collected.reason,
        stderr: "stderr" in collected ? collected.stderr : undefined,
      },
      { status: 400 }
    );
  }

  try {
    const report = await analyzeRepo(collected);
    const { systems, unattributedFindings } = await synthesizeSystems(report);

    // === Layer C: Profile + Code 머지 ===
    const merged = mergeProfileAndCode(systems, parsed.profile);

    // === Gemini refine (선택) ===
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

    // === Service-level compliance report (Gemini) ===
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
      sourceKind: parsed.kind,
      repoUrl: collected.normalizedUrl,
      commitSha: collected.commitSha,
      stats: {
        totalFiles: report.fileTree.totalFiles,
        languageStats: report.fileTree.languageStats,
        totalFindings: report.findings.length,
      },
      systems,
      unattributedFindings: unattributedFindings.slice(0, 50),
      // Layer A+B+C 통합 결과
      profileIntake: parsed.profile,
      profileEvaluation: merged.profileEvaluation,
      mergedObligations: merged.mergedObligations,
      contradictions: merged.contradictions,
      // Gemini refine + report (legacy)
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
