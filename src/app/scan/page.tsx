"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { saveEntry } from "@/lib/storage/history";
import type {
  ServiceProfile,
  ComplianceReport,
  RiskItem,
  SystemAnalysis,
  ObligationDeepDive,
  ActionItem,
} from "@/lib/report/schema";
import { ObligationChip } from "@/components/ObligationChip";
import { CitationsBlock, VerifiedBadge } from "@/components/CitationsBlock";
import { obligationSourceUrl } from "@/lib/laws/labels";

interface AISystem {
  id: string;
  name: string;
  purpose: string;
  catalogEntryId: string;
  procurement: string;
  modelProvider: string;
  modelName?: string;
  isForeignModel: boolean;
  domains: string[];
  modalities: string[];
  isGenerative: boolean;
  trainsOrFineTunes: boolean;
  derivedRiskTier: "high" | "medium" | "low";
  triggeredObligations: string[];
  confidence: "high" | "medium" | "low";
  evidence: { catalogEntryIds: string[]; ruleIds: string[]; filePaths: string[] };
}

interface ScanResponse {
  ok: true;
  repoUrl: string;
  commitSha: string;
  stats: {
    totalFiles: number;
    languageStats: Record<string, number>;
    totalFindings: number;
  };
  systems: AISystem[];
  unattributedFindings: Array<{ ruleId?: string; filePath: string; lineStart: number }>;
  serviceProfile: ServiceProfile | null;
  report: ComplianceReport | null;
  reportError: string | null;
}

const RISK_BADGE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border border-rose-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const APPLICABILITY_BADGE: Record<string, string> = {
  applicable: "bg-rose-100 text-rose-700 border border-rose-200",
  conditional: "bg-amber-100 text-amber-700 border border-amber-200",
  not_applicable: "bg-slate-100 text-slate-500 border border-slate-300",
};

const APPLICABILITY_LABEL: Record<string, string> = {
  applicable: "적용",
  conditional: "조건부",
  not_applicable: "비적용",
};

const OWNER_LABEL: Record<string, string> = {
  engineering: "엔지니어링",
  legal: "법무",
  product: "프로덕트",
  security: "보안",
  executive: "임원",
};

const EFFORT_LABEL: Record<string, string> = {
  S: "S (<1주)",
  M: "M (1~4주)",
  L: "L (>4주)",
};

function overallRiskOf(systems: AISystem[]): "high" | "medium" | "low" | "none" {
  if (systems.length === 0) return "none";
  if (systems.some((s) => s.derivedRiskTier === "high")) return "high";
  if (systems.some((s) => s.derivedRiskTier === "medium")) return "medium";
  return "low";
}

export default function ScanPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!result) return;
    const saved = saveEntry({
      type: "scan",
      title: result.repoUrl,
      overallRisk: result.report?.overallRisk ?? overallRiskOf(result.systems),
      systemCount: result.systems.length,
      payload: result,
    });
    setSavedId(saved.id);
  }, [result]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setSavedId(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error +
            (data.reason ? `: ${data.reason}` : "") +
            (data.detail ? `\n${data.detail}` : "")
        );
      } else {
        setResult(data as ScanResponse);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-600 mb-2">
          GitHub URL 입력
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          코드 스캔
        </h1>
      </header>

      <form
        onSubmit={onSubmit}
        className="card-hover rounded-2xl border border-slate-200 bg-white p-6 mb-6 space-y-4 shadow-sm"
      >
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
            GitHub 저장소 URL (https://)
          </span>
          <input
            type="url"
            required
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full rounded-md bg-white border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="block text-xs text-slate-400 mt-1">
            github.com / gitlab.com / bitbucket.org / codeberg.org 만 허용. depth=1, blob ≤10MB.
          </span>
        </label>
        <button
          type="submit"
          disabled={loading || repoUrl.length === 0}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 px-4 py-3 font-medium transition"
        >
          {loading ? "분석 중… (수집 → 합성 → 서비스 프로파일 → 컴플라이언스 리포트)" : "스캔 실행"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700 mb-6">
          <strong className="block mb-1">오류</strong>
          <pre className="text-xs whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {result && <ScanResultView result={result} savedId={savedId} />}
    </main>
  );
}

export function ScanResultView({
  result,
  savedId,
}: {
  result: ScanResponse;
  savedId?: string | null;
}) {
  if (result.report && result.serviceProfile) {
    return (
      <ComplianceReportView
        repoUrl={result.repoUrl}
        commitSha={result.commitSha}
        profile={result.serviceProfile}
        report={result.report}
        systems={result.systems}
        savedId={savedId}
      />
    );
  }
  // 폴백: 리포트 생성 실패 또는 GEMINI_API_KEY 미설정
  return <BareSystemsView result={result} />;
}

function ComplianceReportView({
  repoUrl,
  commitSha,
  profile,
  report,
  systems,
  savedId,
}: {
  repoUrl: string;
  commitSha: string;
  profile: ServiceProfile;
  report: ComplianceReport;
  systems: AISystem[];
  savedId?: string | null;
}) {
  const systemNameById = new Map(systems.map((s) => [s.id, s.name]));

  return (
    <section className="space-y-6">
      {/* 인쇄/PDF 버튼 */}
      {savedId && (
        <div className="flex justify-end">
          <Link
            href={`/scan/print/${savedId}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition shadow-sm"
          >
            공식 보고서 인쇄 / PDF 다운로드 →
          </Link>
        </div>
      )}

      {/* Executive Summary */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="text-xs text-slate-400 mb-1">컴플라이언스 리포트</div>
            <div className="text-sm text-slate-700 break-words">
              <code className="text-xs">{repoUrl}</code>{" "}
              <span className="text-slate-400">·</span>{" "}
              <code className="text-xs">{commitSha.slice(0, 12)}</code>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded shrink-0 ${RISK_BADGE[report.overallRisk]}`}>
            전체 위험: {report.overallRisk.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
          <Stat label="서비스 도메인" value={profile.primaryDomain} />
          <Stat label="검출 시스템" value={`${systems.length}개`} />
          <Stat label="리스크 항목" value={`${report.riskRegister.length}개`} />
          <Stat label="P1 긴급 액션" value={`${report.roadmap.p1_urgent.length}개`} />
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="text-xs uppercase tracking-wider text-indigo-600 mb-2">
            Executive Summary
          </div>
          <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">
            {report.executiveSummary}
          </p>
        </div>
      </div>

      {/* Service Profile */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm uppercase tracking-wider text-slate-500 mb-3">서비스 프로파일</h2>
        <p className="text-sm text-slate-900 mb-3">{profile.servicePurpose}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-700">
          <Pair k="사용자" v={profile.userTypes.join(", ")} />
          <Pair k="도메인" v={profile.primaryDomain} />
          <Pair k="데이터 민감도" v={profile.dataSensitivity} />
          <Pair k="데이터 종류" v={profile.dataKinds.join(", ") || "-"} />
          <Pair k="결정 자동화" v={profile.decisionAutomation} />
          <Pair k="외부 노출" v={profile.customerExposure ? "예" : "아니오"} />
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-800">
            판단 근거
          </summary>
          <p className="text-xs text-slate-700 mt-2 leading-relaxed">{profile.reasoning}</p>
          {profile.evidenceFiles.length > 0 && (
            <ul className="mt-2 font-mono text-[11px] text-slate-400 space-y-0.5">
              {profile.evidenceFiles.slice(0, 10).map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
          )}
        </details>
      </div>

      {/* Risk Register */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm uppercase tracking-wider text-slate-500 mb-3">
          리스크 레지스터 ({report.riskRegister.length})
        </h2>
        <div className="space-y-2">
          {report.riskRegister.map((r) => (
            <RiskRow key={r.id} risk={r} systemNameById={systemNameById} />
          ))}
        </div>
      </div>

      {/* System Analyses */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm uppercase tracking-wider text-slate-500 mb-3">
          시스템 분석 ({report.systemAnalyses.length})
        </h2>
        <div className="space-y-2">
          {report.systemAnalyses.map((sa) => (
            <SystemAnalysisRow
              key={sa.systemId}
              analysis={sa}
              systemName={systemNameById.get(sa.systemId) ?? sa.systemId}
            />
          ))}
        </div>
      </div>

      {/* Obligation Deep Dive */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm uppercase tracking-wider text-slate-500">
            의무 심화 분석 ({report.obligationDeepDive.length}개 / 9개)
          </h2>
          <ObligationVerificationStats items={report.obligationDeepDive} />
        </div>
        <div className="space-y-2">
          {report.obligationDeepDive.map((o) => (
            <ObligationRow key={o.obligationId} item={o} systemNameById={systemNameById} />
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm uppercase tracking-wider text-slate-500 mb-3">로드맵</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RoadmapColumn title="P1 긴급 (30일)" tone="red" items={report.roadmap.p1_urgent} />
          <RoadmapColumn
            title="P2 중요 (90일, 시행일 전)"
            tone="amber"
            items={report.roadmap.p2_important}
          />
          <RoadmapColumn title="P3 계획 (분기)" tone="sky" items={report.roadmap.p3_planned} />
        </div>
      </div>

      {/* Open Questions */}
      {report.openQuestions.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm uppercase tracking-wider text-slate-500 mb-3">
            정보 부족 / 인간 결정 필요 ({report.openQuestions.length})
          </h2>
          <ul className="space-y-2 text-sm text-slate-800">
            {report.openQuestions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-slate-400">Q{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ObligationVerificationStats({
  items,
}: {
  items: ObligationDeepDive[];
}) {
  const applicable = items.filter((i) => i.applicability !== "not_applicable");
  const verified = applicable.filter((i) => i.verified).length;
  const total = applicable.length;
  const allOk = total > 0 && verified === total;
  return (
    <span
      className={`text-[11px] px-2 py-1 rounded border ${
        allOk
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      RAG 검증 {verified}/{total}{" "}
      {allOk ? "· 모두 통과" : "· 일부 미검증 (법무 재확인 필요)"}
    </span>
  );
}

function RiskRow({
  risk,
  systemNameById,
}: {
  risk: RiskItem;
  systemNameById: Map<string, string>;
}) {
  const score = risk.severity * risk.likelihood;
  const tone =
    score >= 16
      ? "border-rose-200 bg-rose-50"
      : score >= 9
        ? "border-amber-200 bg-amber-50"
        : "border-slate-300 bg-white";
  return (
    <details className={`rounded-lg border ${tone} p-3`}>
      <summary className="cursor-pointer flex items-start gap-3 text-sm">
        <div className="flex flex-col items-center shrink-0 w-12">
          <div className="text-xs text-slate-400">S×L</div>
          <div className="text-base font-semibold">
            {risk.severity}×{risk.likelihood}
          </div>
          <div className="text-[10px] text-slate-400">={score}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-900">{risk.title}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            <span className="text-slate-400">담당:</span> {OWNER_LABEL[risk.owner] ?? risk.owner}
            {risk.affectedObligations.length > 0 && (
              <>
                <span className="text-slate-400"> · </span>
                <span className="text-slate-400">의무:</span>{" "}
                {risk.affectedObligations.join(", ")}
              </>
            )}
          </div>
        </div>
      </summary>
      <div className="mt-3 pl-15 space-y-2 text-xs text-slate-700">
        <div>
          <span className="text-slate-400 uppercase tracking-wider text-[10px]">영향: </span>
          {risk.impact}
        </div>
        <div>
          <span className="text-slate-400 uppercase tracking-wider text-[10px]">완화: </span>
          {risk.mitigation}
        </div>
        {risk.affectedSystemIds.length > 0 && (
          <div>
            <span className="text-slate-400 uppercase tracking-wider text-[10px]">시스템: </span>
            {risk.affectedSystemIds.map((id) => systemNameById.get(id) ?? id).join(", ")}
          </div>
        )}
      </div>
    </details>
  );
}

function SystemAnalysisRow({
  analysis,
  systemName,
}: {
  analysis: SystemAnalysis;
  systemName: string;
}) {
  return (
    <details className="rounded-lg border border-slate-300 bg-white p-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-900">
        {systemName}
        <span className="text-xs text-slate-400 ml-2">— {analysis.role}</span>
      </summary>
      <div className="mt-3 space-y-2 text-xs text-slate-700">
        <Block title="데이터 흐름">{analysis.dataFlow}</Block>
        {analysis.crossSystemInteractions.length > 0 && (
          <Block title="다른 시스템과의 상호작용">
            <ul className="space-y-0.5 list-disc list-inside">
              {analysis.crossSystemInteractions.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </Block>
        )}
        <Block title="리스크 서술">{analysis.riskNarrative}</Block>
        {analysis.mitigations.length > 0 && (
          <Block title="완화 조치">
            <ul className="space-y-0.5 list-disc list-inside">
              {analysis.mitigations.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </Block>
        )}
        {analysis.auditableArtifacts.length > 0 && (
          <Block title="감사 산출물">
            <ul className="space-y-0.5 list-disc list-inside">
              {analysis.auditableArtifacts.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </Block>
        )}
      </div>
    </details>
  );
}

function ObligationRow({
  item,
  systemNameById,
}: {
  item: ObligationDeepDive;
  systemNameById: Map<string, string>;
}) {
  return (
    <details
      className="rounded-lg border border-slate-300 bg-white p-3"
      open={item.applicability === "applicable"}
    >
      <summary className="cursor-pointer flex items-start gap-3 text-sm">
        <span
          className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${APPLICABILITY_BADGE[item.applicability]}`}
        >
          {APPLICABILITY_LABEL[item.applicability]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-900">{item.title}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.obligationId}</div>
        </div>
        <VerifiedBadge verified={item.verified} />
      </summary>
      <div className="mt-3 space-y-2 text-xs text-slate-700">
        <Block title="판단 근거">{item.rationale}</Block>
        <Block title={`근거 조문 인용 (${item.citations.length})`}>
          <CitationsBlock citations={item.citations} obligationId={item.obligationId} />
          {obligationSourceUrl(item.obligationId) && (
            <a
              href={obligationSourceUrl(item.obligationId)}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 text-[10px] text-slate-400 hover:text-indigo-600 underline underline-offset-2"
            >
              원문: 국가법령정보센터 →
            </a>
          )}
        </Block>
        {item.triggeringSystems.length > 0 && (
          <Block title="트리거 시스템">
            {item.triggeringSystems.map((id) => systemNameById.get(id) ?? id).join(", ")}
          </Block>
        )}
        {item.requiredEvidence.length > 0 && (
          <Block title="필요 증거">
            <ul className="space-y-0.5 list-disc list-inside">
              {item.requiredEvidence.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </Block>
        )}
        {item.immediateActions.length > 0 && (
          <Block title="즉시 조치 (30일)">
            <ul className="space-y-0.5 list-disc list-inside">
              {item.immediateActions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </Block>
        )}
        {item.longTermActions.length > 0 && (
          <Block title="장기 조치 (90일+)">
            <ul className="space-y-0.5 list-disc list-inside">
              {item.longTermActions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </Block>
        )}
        {item.blockers.length > 0 && (
          <Block title="블로커">
            <ul className="space-y-0.5 list-disc list-inside text-amber-700">
              {item.blockers.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </Block>
        )}
      </div>
    </details>
  );
}

function RoadmapColumn({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "red" | "amber" | "sky";
  items: ActionItem[];
}) {
  const toneCls = {
    red: "border-rose-300 text-rose-700",
    amber: "border-amber-300 text-amber-700",
    sky: "border-sky-300 text-sky-700",
  }[tone];
  return (
    <div className={`rounded-lg border ${toneCls.split(" ")[0]} bg-slate-50/80 p-3`}>
      <h3 className={`text-xs uppercase tracking-wider mb-3 ${toneCls.split(" ")[1]}`}>
        {title} · {items.length}건
      </h3>
      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-xs text-slate-400">(해당 항목 없음)</li>
        )}
        {items.map((a, i) => (
          <li
            key={i}
            className="rounded border border-slate-200 bg-white p-2 text-xs text-slate-800"
          >
            <div className="font-medium">{a.title}</div>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-slate-100">
                {OWNER_LABEL[a.owner] ?? a.owner}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100">
                {EFFORT_LABEL[a.effort]}
              </span>
              {a.relatedObligations.map((o) => (
                <span key={o} className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  {o}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BareSystemsView({ result }: { result: ScanResponse }) {
  const overall = overallRiskOf(result.systems);
  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-400 mb-1">스캔 결과 (리포트 미생성)</div>
            <div className="text-sm text-slate-700 break-words">
              <code className="text-xs">{result.repoUrl}</code>{" "}
              <span className="text-slate-400">·</span>{" "}
              <code className="text-xs">{result.commitSha.slice(0, 12)}</code>
            </div>
          </div>
          {overall !== "none" && (
            <span className={`text-xs px-2 py-1 rounded ${RISK_BADGE[overall]}`}>
              {overall.toUpperCase()}
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400">
          {result.reportError
            ? `Gemini 리포트 생성 실패: ${result.reportError}`
            : "GEMINI_API_KEY 미설정 — 결정적 시스템 식별 결과만 표시."}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm uppercase tracking-wider text-slate-500 mb-3">
          검출 시스템 ({result.systems.length})
        </h2>
        <ul className="space-y-2 text-sm">
          {result.systems.map((s) => (
            <li key={s.id} className="flex items-start gap-3 border-b border-slate-200 pb-2">
              <span className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${RISK_BADGE[s.derivedRiskTier]}`}>
                {s.derivedRiskTier}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-slate-500">{s.purpose}</div>
                {s.triggeredObligations.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.triggeredObligations.map((o) => (
                      <ObligationChip key={o} obligationId={o} compact />
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className="text-lg font-semibold text-slate-900 truncate">{value}</div>
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-slate-400">{k}:</span> {v}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">{title}</div>
      <div className="text-slate-800">{children}</div>
    </div>
  );
}
