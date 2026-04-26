"use client";

/**
 * Scan 결과 렌더링 — wizard와 dashboard에서 공용으로 사용.
 *
 * - Layer C 매트릭스 (결정적, 항상 표시)
 * - Profile 평가 근거
 * - 검출 시스템 목록
 * - (선택) Gemini 보조 리포트
 */
import Link from "next/link";
import { MergedObligationMatrix } from "@/components/MergedObligationMatrix";
import { ContradictionBanner } from "@/components/ContradictionBanner";
import type {
  MergedObligation,
  ContradictionFlag,
} from "@/lib/scan/profile/merge";
import type { ProfileRuleResult } from "@/lib/scan/profile/rules";
import type { ServiceProfileIntake } from "@/lib/scan/profile/schema";
import type {
  ServiceProfile,
  ComplianceReport,
} from "@/lib/report/schema";
import { LegacyReportView, BareSystemsList } from "./LegacyReportView";

interface AISystem {
  id: string;
  name: string;
  purpose: string;
  catalogEntryId: string;
  modelProvider: string;
  isForeignModel: boolean;
  derivedRiskTier: "high" | "medium" | "low";
  triggeredObligations: string[];
}

export interface ScanResult {
  ok?: true;
  sourceKind?: "git" | "zip";
  repoUrl: string;
  commitSha: string;
  stats?: {
    totalFiles: number;
    languageStats: Record<string, number>;
    totalFindings: number;
  };
  systems: AISystem[];
  profileIntake?: ServiceProfileIntake | null;
  profileEvaluation?: ProfileRuleResult | null;
  mergedObligations?: MergedObligation[];
  contradictions?: ContradictionFlag[];
  serviceProfile: ServiceProfile | null;
  report: ComplianceReport | null;
  reportError?: string | null;
  truncatedSystems?: number;
}

export function ScanResultView({
  result,
  savedId,
  onReset,
}: {
  result: ScanResult;
  savedId?: string | null;
  onReset?: () => void;
}) {
  const merged = result.mergedObligations ?? [];
  const contradictions = result.contradictions ?? [];
  const requiredCount = merged.filter((m) => m.status === "REQUIRED").length;

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-xs text-slate-500 mb-1">스캔 결과</div>
            <div className="text-sm text-slate-800 break-words">
              <code className="text-xs">{result.repoUrl}</code>
              {result.commitSha ? (
                <>
                  {" "}
                  <span className="text-slate-400">·</span>{" "}
                  <code className="text-xs">
                    {result.commitSha.slice(0, 12)}
                  </code>
                </>
              ) : null}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {result.stats
                ? `파일 ${result.stats.totalFiles.toLocaleString()}개 · `
                : ""}
              검출 시스템 {result.systems.length}개 · 의무 {requiredCount}건 필수
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {savedId && (
              <>
                <Link
                  href={`/scan/print/${savedId}?auto=1`}
                  target="_blank"
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition"
                >
                  PDF 다운로드
                </Link>
                <Link
                  href={`/scan/print/${savedId}`}
                  target="_blank"
                  className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 transition"
                >
                  미리보기
                </Link>
              </>
            )}
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition"
              >
                새 스캔
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Layer C — 결정적 매트릭스 (1순위) */}
      <ContradictionBanner items={contradictions} />
      {merged.length > 0 ? (
        <MergedObligationMatrix items={merged} />
      ) : null}

      {/* Layer A 평가 근거 (요약) */}
      {result.profileEvaluation && (
        <details className="rounded-lg border border-slate-200 bg-white">
          <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-slate-900">
            Profile 규칙 평가 — {result.profileEvaluation.decisions.length}개
            의무 판정 근거
          </summary>
          <div className="px-5 pb-4">
            <ul className="text-xs text-slate-700 space-y-1.5">
              {result.profileEvaluation.decisions.map((d) => (
                <li key={d.obligationId} className="flex items-start gap-2">
                  <span
                    className={`text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded ${
                      d.status === "REQUIRED"
                        ? "bg-red-50 text-red-700"
                        : d.status === "CONDITIONAL"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {d.status}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">
                      {d.obligationId}
                    </div>
                    <div className="text-slate-600">{d.reason}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {/* 검출 시스템 */}
      <BareSystemsList systems={result.systems} />

      {/* (선택) Gemini 보조 리포트 */}
      {result.report && result.serviceProfile && (
        <details className="rounded-lg border border-slate-200 bg-white">
          <summary className="px-5 py-3 cursor-pointer text-sm font-semibold text-slate-900">
            보조 분석 (Gemini 기반) — Executive Summary, 리스크 레지스터,
            로드맵
          </summary>
          <div className="px-5 pb-5 pt-2">
            <LegacyReportView
              profile={result.serviceProfile}
              report={result.report}
              systems={result.systems}
              truncatedSystems={result.truncatedSystems}
            />
          </div>
        </details>
      )}

      {!result.report && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          {result.reportError
            ? `Gemini 보조 리포트 생성 실패: ${result.reportError}`
            : "Gemini 보조 리포트 비활성화 — 결정적 결과(Layer C)만 표시 중."}
        </div>
      )}
    </section>
  );
}
