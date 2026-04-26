"use client";

/**
 * 기존 Gemini 기반 컴플라이언스 리포트 뷰. Layer C 매트릭스와 함께 보조 표시.
 * 화이트톤으로 톤다운 (gradient 제거).
 */
import type {
  ServiceProfile,
  ComplianceReport,
  RiskItem,
  SystemAnalysis,
  ObligationDeepDive,
  ActionItem,
} from "@/lib/report/schema";
import { CitationsBlock, VerifiedBadge } from "@/components/CitationsBlock";
import { ObligationChip } from "@/components/ObligationChip";
import { obligationSourceUrl } from "@/lib/laws/labels";

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

const RISK_BADGE: Record<string, string> = {
  high: "bg-red-50 text-red-700 border border-red-200",
  medium: "bg-amber-50 text-amber-800 border border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

const APPLICABILITY_BADGE: Record<string, string> = {
  applicable: "bg-red-50 text-red-700 border border-red-200",
  conditional: "bg-blue-50 text-blue-700 border border-blue-200",
  not_applicable: "bg-slate-50 text-slate-500 border border-slate-200",
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

export function LegacyReportView({
  profile,
  report,
  systems,
  truncatedSystems,
}: {
  profile: ServiceProfile;
  report: ComplianceReport;
  systems: AISystem[];
  truncatedSystems?: number;
}) {
  const systemNameById = new Map(systems.map((s) => [s.id, s.name]));

  return (
    <section className="space-y-5">
      {truncatedSystems && truncatedSystems > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠ 시스템 {truncatedSystems}개가 컴플라이언스 리포트 입력에서
          제외됐습니다 (상위 15개만 분석).
        </div>
      ) : null}

      {/* Executive Summary */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Executive Summary
          </h2>
          <span
            className={`text-xs px-2 py-0.5 rounded shrink-0 ${
              RISK_BADGE[report.overallRisk] ?? RISK_BADGE.low
            }`}
          >
            전체 위험 · {report.overallRisk.toUpperCase()}
          </span>
        </div>
        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
          {report.executiveSummary}
        </p>
      </div>

      {/* Service Profile (Gemini-inferred) */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">
          서비스 프로파일 (코드 기반 추론)
        </h2>
        <p className="text-sm text-slate-800 mb-3">{profile.servicePurpose}</p>
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
          <p className="text-xs text-slate-700 mt-2 leading-relaxed">
            {profile.reasoning}
          </p>
        </details>
      </div>

      {/* Risk Register */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">
          리스크 레지스터 ({report.riskRegister.length})
        </h2>
        <div className="space-y-2">
          {report.riskRegister.map((r) => (
            <RiskRow
              key={r.id}
              risk={r}
              systemNameById={systemNameById}
            />
          ))}
        </div>
      </div>

      {/* System Analyses */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">
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
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            의무 심화 분석 ({report.obligationDeepDive.length}개 / 9개)
          </h2>
          <ObligationVerificationStats items={report.obligationDeepDive} />
        </div>
        <div className="space-y-2">
          {report.obligationDeepDive.map((o) => (
            <ObligationDeepDiveRow
              key={o.obligationId}
              item={o}
              systemNameById={systemNameById}
            />
          ))}
        </div>
      </div>

      {/* Roadmap */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">로드맵</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <RoadmapColumn
            title="P1 긴급 (30일)"
            tone="red"
            items={report.roadmap.p1_urgent}
          />
          <RoadmapColumn
            title="P2 중요 (90일)"
            tone="amber"
            items={report.roadmap.p2_important}
          />
          <RoadmapColumn
            title="P3 계획 (분기)"
            tone="sky"
            items={report.roadmap.p3_planned}
          />
        </div>
      </div>

      {report.openQuestions.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
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

export function BareSystemsList({ systems }: { systems: AISystem[] }) {
  if (systems.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
        검출된 AI 시스템이 없습니다.
      </div>
    );
  }
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">
        검출 시스템 ({systems.length})
      </h2>
      <ul className="space-y-2 text-sm">
        {systems.map((s) => (
          <li
            key={s.id}
            className="flex items-start gap-3 border-b border-slate-100 last:border-b-0 pb-2 last:pb-0"
          >
            <span
              className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${RISK_BADGE[s.derivedRiskTier]}`}
            >
              {s.derivedRiskTier}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-900">{s.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {s.purpose}{" "}
                <span className="text-slate-400">·</span>{" "}
                <code className="text-[11px]">{s.catalogEntryId}</code>{" "}
                {s.isForeignModel && (
                  <span className="text-amber-700">· 외국 모델</span>
                )}
              </div>
              {s.triggeredObligations.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {s.triggeredObligations.map((o) => (
                    <ObligationChip key={o} obligationId={o} compact />
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

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
      {allOk ? "· 모두 통과" : "· 일부 미검증"}
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
      ? "border-red-200 bg-red-50"
      : score >= 9
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-white";
  return (
    <details className={`rounded-md border ${tone} p-3`}>
      <summary className="cursor-pointer flex items-start gap-3 text-sm">
        <div className="flex flex-col items-center shrink-0 w-12">
          <div className="text-[10px] text-slate-400">S×L</div>
          <div className="text-sm font-semibold">
            {risk.severity}×{risk.likelihood}
          </div>
          <div className="text-[10px] text-slate-400">={score}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-900">{risk.title}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            <span className="text-slate-400">담당:</span>{" "}
            {OWNER_LABEL[risk.owner] ?? risk.owner}
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
      <div className="mt-3 space-y-2 text-xs text-slate-700">
        <Block title="영향">{risk.impact}</Block>
        <Block title="완화">{risk.mitigation}</Block>
        {risk.affectedSystemIds.length > 0 && (
          <Block title="시스템">
            {risk.affectedSystemIds
              .map((id) => systemNameById.get(id) ?? id)
              .join(", ")}
          </Block>
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
    <details className="rounded-md border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-900">
        {systemName}
        <span className="text-xs text-slate-400 ml-2">— {analysis.role}</span>
      </summary>
      <div className="mt-3 space-y-2 text-xs text-slate-700">
        <Block title="데이터 흐름">{analysis.dataFlow}</Block>
        {analysis.crossSystemInteractions.length > 0 && (
          <Block title="상호작용">
            <ul className="space-y-0.5 list-disc list-inside">
              {analysis.crossSystemInteractions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </Block>
        )}
        <Block title="리스크 서술">{analysis.riskNarrative}</Block>
        {analysis.mitigations.length > 0 && (
          <Block title="완화 조치">
            <ul className="space-y-0.5 list-disc list-inside">
              {analysis.mitigations.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </Block>
        )}
        {analysis.auditableArtifacts.length > 0 && (
          <Block title="감사 산출물">
            <ul className="space-y-0.5 list-disc list-inside">
              {analysis.auditableArtifacts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Block>
        )}
      </div>
    </details>
  );
}

function ObligationDeepDiveRow({
  item,
  systemNameById,
}: {
  item: ObligationDeepDive;
  systemNameById: Map<string, string>;
}) {
  return (
    <details
      className="rounded-md border border-slate-200 bg-white p-3"
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
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {item.obligationId}
          </div>
        </div>
        <VerifiedBadge verified={item.verified} />
      </summary>
      <div className="mt-3 space-y-2 text-xs text-slate-700">
        <Block title="판단 근거">{item.rationale}</Block>
        <Block title={`근거 조문 인용 (${item.citations.length})`}>
          <CitationsBlock
            citations={item.citations}
            obligationId={item.obligationId}
            unsupportedRefs={item.unsupportedRefs}
          />
          {obligationSourceUrl(item.obligationId) && (
            <a
              href={obligationSourceUrl(item.obligationId)}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 text-[10px] text-slate-500 hover:text-blue-600 underline underline-offset-2"
            >
              원문: 국가법령정보센터 →
            </a>
          )}
        </Block>
        {item.triggeringSystems.length > 0 && (
          <Block title="트리거 시스템">
            {item.triggeringSystems
              .map((id) => systemNameById.get(id) ?? id)
              .join(", ")}
          </Block>
        )}
        {item.requiredEvidence.length > 0 && (
          <Block title="필요 증거">
            <ul className="space-y-0.5 list-disc list-inside">
              {item.requiredEvidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Block>
        )}
        {item.immediateActions.length > 0 && (
          <Block title="즉시 조치 (30일)">
            <ul className="space-y-0.5 list-disc list-inside">
              {item.immediateActions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Block>
        )}
        {item.longTermActions.length > 0 && (
          <Block title="장기 조치 (90일+)">
            <ul className="space-y-0.5 list-disc list-inside">
              {item.longTermActions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Block>
        )}
        {item.blockers.length > 0 && (
          <Block title="블로커">
            <ul className="space-y-0.5 list-disc list-inside text-amber-700">
              {item.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
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
    red: "border-red-200 text-red-700",
    amber: "border-amber-200 text-amber-700",
    sky: "border-sky-200 text-sky-700",
  }[tone];
  return (
    <div className={`rounded-md border ${toneCls.split(" ")[0]} bg-slate-50 p-3`}>
      <h3
        className={`text-xs uppercase tracking-wider mb-3 ${toneCls.split(" ")[1]}`}
      >
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
                <span
                  key={o}
                  className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700"
                >
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

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-slate-400">{k}:</span> {v}
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
        {title}
      </div>
      <div className="text-slate-800">{children}</div>
    </div>
  );
}
