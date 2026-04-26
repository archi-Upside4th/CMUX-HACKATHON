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
import { Icon } from "@/components/Icon";

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

const RISK_PILL: Record<string, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

const APP_PILL: Record<string, string> = {
  applicable: "bg-rose-100 text-rose-700",
  conditional: "bg-amber-100 text-amber-700",
  not_applicable: "bg-slate-100 text-slate-500",
};

const APP_LABEL: Record<string, string> = {
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
  S: "S",
  M: "M",
  L: "L",
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
    <main className="mx-auto w-full max-w-6xl px-6 pt-6 pb-16">
      <header className="mb-10">
        <h1 className="text-[44px] sm:text-[56px] font-semibold tracking-[-0.02em] leading-none text-slate-900">
          스캔
        </h1>
      </header>

      <form
        onSubmit={onSubmit}
        className="rounded-3xl bg-white p-2 mb-6 flex items-center gap-2"
      >
        <span className="grid place-items-center h-11 w-11 rounded-full bg-[var(--surface-2)] text-slate-500 shrink-0">
          <Icon name="scan" size={18} />
        </span>
        <input
          type="url"
          required
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="flex-1 bg-transparent border-0 px-1 py-2 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || repoUrl.length === 0}
          className="rounded-full bg-slate-900 hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 text-white px-5 py-2.5 text-[13px] font-medium transition shrink-0"
        >
          {loading ? "분석 중…" : "스캔"}
        </button>
      </form>

      {error && (
        <div className="rounded-3xl bg-rose-50 p-6 text-rose-700 mb-6">
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
    <section className="space-y-3">
      {/* Hero summary */}
      <div className="rounded-3xl bg-slate-900 text-white p-7 sm:p-9">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-white/45 mb-1">
              컴플라이언스 리포트
            </div>
            <div className="text-[14px] text-white/80 truncate font-mono">
              {repoUrl}
            </div>
          </div>
          <span
            className={`text-[11px] px-3 py-1.5 rounded-full font-medium shrink-0 ${RISK_PILL[report.overallRisk]}`}
          >
            {report.overallRisk.toUpperCase()}
          </span>
        </div>

        <p className="text-[15px] leading-relaxed text-white/90 mb-6 whitespace-pre-wrap">
          {report.executiveSummary}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HeroStat label="시스템" value={systems.length} />
          <HeroStat label="리스크" value={report.riskRegister.length} />
          <HeroStat label="P1 액션" value={report.roadmap.p1_urgent.length} />
          <HeroStat label="의무" value={report.obligationDeepDive.length} suffix="/9" />
        </div>

        {savedId && (
          <Link
            href={`/scan/print/${savedId}`}
            target="_blank"
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-slate-900 text-[13px] font-medium hover:bg-slate-100 transition"
          >
            <Icon name="doc" size={14} />
            공식 보고서
            <Icon name="arrow-up-right" size={13} />
          </Link>
        )}

        <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-white/45 font-mono">
          <span>{commitSha.slice(0, 12)}</span>
          <span>{profile.primaryDomain}</span>
        </div>
      </div>

      {/* Service profile */}
      <div className="rounded-3xl bg-white p-7">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-3">
          서비스
        </div>
        <p className="text-[15px] text-slate-900 mb-4">{profile.servicePurpose}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 text-[13px]">
          <Pair k="사용자" v={profile.userTypes.join(", ")} />
          <Pair k="도메인" v={profile.primaryDomain} />
          <Pair k="민감도" v={profile.dataSensitivity} />
          <Pair k="데이터" v={profile.dataKinds.join(", ") || "-"} />
          <Pair k="자동화" v={profile.decisionAutomation} />
          <Pair k="외부 노출" v={profile.customerExposure ? "예" : "아니오"} />
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-[12px] text-slate-400 hover:text-slate-900 transition list-none flex items-center gap-1">
            <Icon name="chevron-right" size={12} />
            판단 근거
          </summary>
          <p className="text-[12px] text-slate-700 mt-2 leading-relaxed">
            {profile.reasoning}
          </p>
        </details>
      </div>

      {/* Risk register */}
      <SectionCard title="리스크" count={report.riskRegister.length}>
        <div className="space-y-1.5">
          {report.riskRegister.map((r) => (
            <RiskRow key={r.id} risk={r} systemNameById={systemNameById} />
          ))}
        </div>
      </SectionCard>

      {/* System analyses */}
      <SectionCard title="시스템 분석" count={report.systemAnalyses.length}>
        <div className="space-y-1.5">
          {report.systemAnalyses.map((sa) => (
            <SystemAnalysisRow
              key={sa.systemId}
              analysis={sa}
              systemName={systemNameById.get(sa.systemId) ?? sa.systemId}
            />
          ))}
        </div>
      </SectionCard>

      {/* Obligations */}
      <SectionCard
        title="의무"
        count={report.obligationDeepDive.length}
        right={<ObligationVerificationStats items={report.obligationDeepDive} />}
      >
        <div className="space-y-1.5">
          {report.obligationDeepDive.map((o) => (
            <ObligationRow key={o.obligationId} item={o} systemNameById={systemNameById} />
          ))}
        </div>
      </SectionCard>

      {/* Roadmap */}
      <SectionCard title="로드맵">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <RoadmapColumn title="P1 · 30일" tone="rose" items={report.roadmap.p1_urgent} />
          <RoadmapColumn title="P2 · 90일" tone="amber" items={report.roadmap.p2_important} />
          <RoadmapColumn title="P3 · 분기" tone="slate" items={report.roadmap.p3_planned} />
        </div>
      </SectionCard>

      {report.openQuestions.length > 0 && (
        <SectionCard title="열린 질문" count={report.openQuestions.length}>
          <ul className="space-y-2 text-[13px] text-slate-800">
            {report.openQuestions.map((q, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-slate-400 tabular-nums">Q{i + 1}</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </section>
  );
}

function HeroStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1.5">
        {label}
      </div>
      <div className="text-[26px] font-semibold tabular-nums leading-none">
        {value}
        {suffix && <span className="text-[14px] text-white/45 ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  count,
  right,
  children,
}: {
  title: string;
  count?: number;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white p-6 sm:p-7">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {count !== undefined && (
            <span className="text-[12px] text-slate-400 tabular-nums">{count}</span>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
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
      className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full ${
        allOk
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      <Icon name={allOk ? "shield-check" : "spark"} size={12} />
      <span className="font-mono tabular-nums">
        {verified}/{total}
      </span>
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
    score >= 16 ? "bg-rose-50" : score >= 9 ? "bg-amber-50" : "bg-[var(--surface-2)]";
  return (
    <details className={`rounded-2xl ${tone} p-4`}>
      <summary className="cursor-pointer flex items-start gap-4 text-sm list-none">
        <div className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-white">
          <div className="text-[10px] text-slate-400 leading-none mb-0.5">S×L</div>
          <div className="text-[14px] font-semibold tabular-nums leading-none">
            {score}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-900 text-[14px]">{risk.title}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3">
            <span>{OWNER_LABEL[risk.owner] ?? risk.owner}</span>
            {risk.affectedObligations.length > 0 && (
              <span className="font-mono">{risk.affectedObligations.join(" · ")}</span>
            )}
          </div>
        </div>
      </summary>
      <div className="mt-4 pl-16 space-y-2 text-[12px] text-slate-700">
        <div>
          <span className="text-slate-400 mr-1.5">영향</span>
          {risk.impact}
        </div>
        <div>
          <span className="text-slate-400 mr-1.5">완화</span>
          {risk.mitigation}
        </div>
        {risk.affectedSystemIds.length > 0 && (
          <div>
            <span className="text-slate-400 mr-1.5">시스템</span>
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
    <details className="rounded-2xl bg-[var(--surface-2)] p-4">
      <summary className="cursor-pointer text-sm list-none flex items-center justify-between gap-3">
        <span className="font-medium text-slate-900 text-[14px]">
          {systemName}
        </span>
        <span className="text-[11px] text-slate-500 truncate">{analysis.role}</span>
      </summary>
      <div className="mt-3 space-y-3 text-[12px] text-slate-700">
        <Block title="데이터 흐름">{analysis.dataFlow}</Block>
        {analysis.crossSystemInteractions.length > 0 && (
          <Block title="상호작용">
            <ul className="space-y-0.5">
              {analysis.crossSystemInteractions.map((c, i) => (
                <li key={i}>· {c}</li>
              ))}
            </ul>
          </Block>
        )}
        <Block title="리스크">{analysis.riskNarrative}</Block>
        {analysis.mitigations.length > 0 && (
          <Block title="완화">
            <ul className="space-y-0.5">
              {analysis.mitigations.map((m, i) => <li key={i}>· {m}</li>)}
            </ul>
          </Block>
        )}
        {analysis.auditableArtifacts.length > 0 && (
          <Block title="산출물">
            <ul className="space-y-0.5">
              {analysis.auditableArtifacts.map((a, i) => <li key={i}>· {a}</li>)}
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
      className="rounded-2xl bg-[var(--surface-2)] p-4"
      open={item.applicability === "applicable"}
    >
      <summary className="cursor-pointer flex items-center gap-3 text-sm list-none">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${APP_PILL[item.applicability]}`}
        >
          {APP_LABEL[item.applicability]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-900 text-[14px]">{item.title}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {item.obligationId}
          </div>
        </div>
        <VerifiedBadge verified={item.verified} />
      </summary>
      <div className="mt-4 space-y-3 text-[12px] text-slate-700">
        <Block title="판단 근거">{item.rationale}</Block>
        <Block title={`근거 조문 · ${item.citations.length}`}>
          <CitationsBlock citations={item.citations} obligationId={item.obligationId} />
          {obligationSourceUrl(item.obligationId) && (
            <a
              href={obligationSourceUrl(item.obligationId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-[11px] text-slate-400 hover:text-slate-900 transition"
            >
              국가법령정보센터
              <Icon name="arrow-up-right" size={11} />
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
            <ul className="space-y-0.5">
              {item.requiredEvidence.map((e, i) => <li key={i}>· {e}</li>)}
            </ul>
          </Block>
        )}
        {item.immediateActions.length > 0 && (
          <Block title="즉시 (30일)">
            <ul className="space-y-0.5">
              {item.immediateActions.map((a, i) => <li key={i}>· {a}</li>)}
            </ul>
          </Block>
        )}
        {item.longTermActions.length > 0 && (
          <Block title="장기 (90일+)">
            <ul className="space-y-0.5">
              {item.longTermActions.map((a, i) => <li key={i}>· {a}</li>)}
            </ul>
          </Block>
        )}
        {item.blockers.length > 0 && (
          <Block title="블로커">
            <ul className="space-y-0.5 text-amber-700">
              {item.blockers.map((b, i) => <li key={i}>· {b}</li>)}
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
  tone: "rose" | "amber" | "slate";
  items: ActionItem[];
}) {
  const dot = {
    rose: "bg-rose-500",
    amber: "bg-amber-500",
    slate: "bg-slate-400",
  }[tone];
  return (
    <div className="rounded-2xl bg-[var(--surface-2)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <h3 className="text-[12px] font-medium text-slate-900">
          {title}
        </h3>
        <span className="text-[11px] text-slate-400 tabular-nums ml-auto">
          {items.length}
        </span>
      </div>
      <ul className="space-y-2">
        {items.length === 0 && (
          <li className="text-[12px] text-slate-400">—</li>
        )}
        {items.map((a, i) => (
          <li
            key={i}
            className="rounded-xl bg-white p-3 text-[12px] text-slate-800"
          >
            <div className="font-medium leading-snug">{a.title}</div>
            <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-500">
              <span>{OWNER_LABEL[a.owner] ?? a.owner}</span>
              <span className="text-slate-300">·</span>
              <span>{EFFORT_LABEL[a.effort]}</span>
              {a.relatedObligations.length > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono">{a.relatedObligations.join(" ")}</span>
                </>
              )}
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
    <section className="space-y-3">
      <div className="rounded-3xl bg-white p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">
              결과
            </div>
            <div className="text-[13px] text-slate-700 break-words font-mono">
              {result.repoUrl}
            </div>
          </div>
          {overall !== "none" && (
            <span className={`text-[11px] px-2.5 py-1 rounded-full ${RISK_PILL[overall]}`}>
              {overall.toUpperCase()}
            </span>
          )}
        </div>
      </div>
      <SectionCard title="시스템" count={result.systems.length}>
        <ul className="space-y-2.5">
          {result.systems.map((s) => (
            <li key={s.id} className="flex items-start gap-3 py-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${RISK_PILL[s.derivedRiskTier]}`}>
                {s.derivedRiskTier.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[14px] text-slate-900">{s.name}</div>
                <div className="text-[12px] text-slate-500 mt-0.5">{s.purpose}</div>
                {s.triggeredObligations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.triggeredObligations.map((o) => (
                      <ObligationChip key={o} obligationId={o} compact />
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </section>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
        {k}
      </div>
      <div className="text-slate-900">{v}</div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
        {title}
      </div>
      <div className="text-slate-800">{children}</div>
    </div>
  );
}
