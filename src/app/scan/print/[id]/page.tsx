"use client";

import { useEffect, useState, use } from "react";
import { getEntry, type HistoryEntry } from "@/lib/storage/history";
import type {
  ServiceProfile,
  ComplianceReport,
} from "@/lib/report/schema";

interface AISystem {
  id: string;
  name: string;
  catalogEntryId: string;
  procurement: string;
  modelProvider: string;
  modelName?: string;
  isForeignModel: boolean;
  domains: string[];
  derivedRiskTier: "high" | "medium" | "low";
  triggeredObligations: string[];
}

interface ScanPayload {
  repoUrl: string;
  commitSha: string;
  systems: AISystem[];
  serviceProfile: ServiceProfile | null;
  report: ComplianceReport | null;
}

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

export default function PrintReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const e = getEntry(id);
    setEntry(e);
    setLoaded(true);
  }, [id]);

  if (!loaded) {
    return <div className="p-10 text-sm text-zinc-500">불러오는 중…</div>;
  }
  if (!entry) {
    return (
      <div className="p-10 text-sm text-zinc-500">
        기록을 찾지 못했습니다 (id: {id}).
      </div>
    );
  }
  if (entry.type !== "scan") {
    return (
      <div className="p-10 text-sm text-zinc-500">
        이 기록은 scan 타입이 아닙니다.
      </div>
    );
  }
  const payload = entry.payload as ScanPayload;
  if (!payload.report || !payload.serviceProfile) {
    return (
      <div className="p-10 text-sm text-zinc-500">
        이 스캔에는 컴플라이언스 리포트가 포함되어 있지 않습니다.
      </div>
    );
  }

  return <PrintableReport payload={payload} createdAt={entry.createdAt} />;
}

function PrintableReport({
  payload,
  createdAt,
}: {
  payload: ScanPayload;
  createdAt: string;
}) {
  const { report, serviceProfile: profile, systems, repoUrl, commitSha } = payload;
  if (!report || !profile) return null;
  const systemNameById = new Map(systems.map((s) => [s.id, s.name]));

  return (
    <>
      {/* 인쇄 전용 스타일 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 18mm 16mm;
          }
          body {
            background: white !important;
            color: #111 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page {
            background: white !important;
            color: #111 !important;
          }
          .print-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-h1 {
            color: #000;
          }
          .print-meta {
            color: #555;
          }
          .print-card {
            border: 1px solid #ccc;
            background: white;
            color: #111;
          }
          .print-muted {
            color: #555;
          }
          .print-badge-high {
            background: #fee;
            color: #900;
            border: 1px solid #c33;
          }
          .print-badge-medium {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #d97706;
          }
          .print-badge-low {
            background: #d1fae5;
            color: #065f46;
            border: 1px solid #059669;
          }
        }
      `}</style>

      {/* 인쇄 버튼 (인쇄 시 숨김) */}
      <div className="no-print sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="text-sm text-zinc-300">
          인쇄 미리보기 — 우측 버튼 → 시스템 인쇄 다이얼로그 → "PDF로 저장"
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-indigo-500 hover:bg-indigo-400 px-4 py-2 text-sm font-medium text-white transition"
        >
          인쇄 / PDF 저장
        </button>
      </div>

      <main className="print-page mx-auto w-full max-w-[820px] px-10 py-8 bg-white text-zinc-900 print:px-0 print:py-0">
        {/* 표지 */}
        <header className="print-section mb-6 pb-4 border-b border-zinc-300">
          <div className="text-xs print-meta uppercase tracking-wider mb-1">
            AI기본법 컴플라이언스 리포트
          </div>
          <h1 className="print-h1 text-2xl font-bold mb-2">
            {profile.servicePurpose}
          </h1>
          <div className="text-xs print-meta space-y-0.5">
            <div>
              <span className="font-medium">저장소:</span>{" "}
              <code className="text-[11px]">{repoUrl}</code>
            </div>
            <div>
              <span className="font-medium">커밋:</span>{" "}
              <code className="text-[11px]">{commitSha.slice(0, 12)}</code>
            </div>
            <div>
              <span className="font-medium">생성일시:</span>{" "}
              {new Date(createdAt).toLocaleString("ko-KR")}
            </div>
            <div>
              <span className="font-medium">전체 위험도:</span>{" "}
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  report.overallRisk === "high"
                    ? "print-badge-high"
                    : report.overallRisk === "medium"
                      ? "print-badge-medium"
                      : "print-badge-low"
                }`}
              >
                {report.overallRisk.toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Executive Summary */}
        <Section title="1. Executive Summary">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {report.executiveSummary}
          </p>
        </Section>

        {/* Service Profile */}
        <Section title="2. 서비스 프로파일">
          <table className="w-full text-xs border border-zinc-300">
            <tbody>
              <Row k="서비스 목적" v={profile.servicePurpose} />
              <Row k="사용자 유형" v={profile.userTypes.join(", ")} />
              <Row k="주요 도메인" v={profile.primaryDomain} />
              <Row k="데이터 민감도" v={profile.dataSensitivity} />
              <Row k="처리 데이터" v={profile.dataKinds.join(", ") || "-"} />
              <Row k="결정 자동화" v={profile.decisionAutomation} />
              <Row
                k="외부 사용자 노출"
                v={profile.customerExposure ? "예" : "아니오"}
              />
            </tbody>
          </table>
          <p className="text-xs mt-2 print-muted">
            <strong>판단 근거:</strong> {profile.reasoning}
          </p>
        </Section>

        {/* Risk Register */}
        <Section title={`3. 리스크 레지스터 (${report.riskRegister.length}건)`}>
          <table className="w-full text-xs border border-zinc-300">
            <thead className="bg-zinc-100">
              <tr>
                <th className="border border-zinc-300 p-1.5 text-left">제목</th>
                <th className="border border-zinc-300 p-1.5 w-10">S</th>
                <th className="border border-zinc-300 p-1.5 w-10">L</th>
                <th className="border border-zinc-300 p-1.5 w-12">점수</th>
                <th className="border border-zinc-300 p-1.5 w-20">담당</th>
              </tr>
            </thead>
            <tbody>
              {report.riskRegister.map((r) => (
                <tr key={r.id} className="print-section">
                  <td className="border border-zinc-300 p-1.5 align-top">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-[11px] print-muted mt-0.5">
                      <strong>영향:</strong> {r.impact}
                    </div>
                    <div className="text-[11px] print-muted mt-0.5">
                      <strong>완화:</strong> {r.mitigation}
                    </div>
                    {r.affectedObligations.length > 0 && (
                      <div className="text-[10px] print-muted mt-0.5">
                        의무: {r.affectedObligations.join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="border border-zinc-300 p-1.5 text-center">
                    {r.severity}
                  </td>
                  <td className="border border-zinc-300 p-1.5 text-center">
                    {r.likelihood}
                  </td>
                  <td className="border border-zinc-300 p-1.5 text-center font-semibold">
                    {r.severity * r.likelihood}
                  </td>
                  <td className="border border-zinc-300 p-1.5 text-[11px]">
                    {OWNER_LABEL[r.owner] ?? r.owner}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* System Analyses */}
        <Section title={`4. 시스템 분석 (${report.systemAnalyses.length}개)`}>
          {report.systemAnalyses.map((sa) => (
            <div key={sa.systemId} className="print-section mb-4 print-card rounded p-3">
              <div className="font-semibold text-sm mb-1">
                {systemNameById.get(sa.systemId) ?? sa.systemId}
                <span className="text-xs print-muted font-normal ml-2">
                  — {sa.role}
                </span>
              </div>
              <DefRow k="데이터 흐름" v={sa.dataFlow} />
              {sa.crossSystemInteractions.length > 0 && (
                <DefRow k="시스템 간 상호작용" v={sa.crossSystemInteractions.join(" / ")} />
              )}
              <DefRow k="리스크 서술" v={sa.riskNarrative} />
              {sa.mitigations.length > 0 && (
                <DefList k="완화 조치" items={sa.mitigations} />
              )}
              {sa.auditableArtifacts.length > 0 && (
                <DefList k="감사 산출물" items={sa.auditableArtifacts} />
              )}
            </div>
          ))}
        </Section>

        {/* Obligations */}
        <Section title={`5. 의무 심화 분석 (${report.obligationDeepDive.length}/9)`}>
          {report.obligationDeepDive.map((o) => (
            <div key={o.obligationId} className="print-section mb-3 print-card rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    o.applicability === "applicable"
                      ? "print-badge-high"
                      : o.applicability === "conditional"
                        ? "print-badge-medium"
                        : "print-badge-low"
                  }`}
                >
                  {APPLICABILITY_LABEL[o.applicability]}
                </span>
                <span className="font-semibold text-sm">{o.title}</span>
                <span className="text-[10px] print-muted font-mono ml-auto">
                  {o.obligationId}
                </span>
              </div>
              <DefRow k="판단 근거" v={o.rationale} />
              {o.triggeringSystems.length > 0 && (
                <DefRow
                  k="트리거 시스템"
                  v={o.triggeringSystems
                    .map((id) => systemNameById.get(id) ?? id)
                    .join(", ")}
                />
              )}
              {o.requiredEvidence.length > 0 && (
                <DefList k="필요 증거" items={o.requiredEvidence} />
              )}
              {o.immediateActions.length > 0 && (
                <DefList k="즉시 조치 (30일)" items={o.immediateActions} />
              )}
              {o.longTermActions.length > 0 && (
                <DefList k="장기 조치 (90일+)" items={o.longTermActions} />
              )}
              {o.blockers.length > 0 && (
                <DefList k="블로커" items={o.blockers} />
              )}
            </div>
          ))}
        </Section>

        {/* Roadmap */}
        <Section title="6. 로드맵">
          <RoadmapTable
            title="P1 긴급 (30일)"
            items={report.roadmap.p1_urgent}
          />
          <RoadmapTable
            title="P2 중요 (90일, 시행일 전)"
            items={report.roadmap.p2_important}
          />
          <RoadmapTable
            title="P3 계획 (분기)"
            items={report.roadmap.p3_planned}
          />
        </Section>

        {/* Open Questions */}
        {report.openQuestions.length > 0 && (
          <Section title={`7. 정보 부족 / 인간 결정 필요 (${report.openQuestions.length})`}>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              {report.openQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </Section>
        )}

        {/* 검출 시스템 부록 */}
        <Section title="부록 A. 검출된 AI 시스템 목록">
          <table className="w-full text-xs border border-zinc-300">
            <thead className="bg-zinc-100">
              <tr>
                <th className="border border-zinc-300 p-1.5 text-left">시스템</th>
                <th className="border border-zinc-300 p-1.5 text-left">공급사</th>
                <th className="border border-zinc-300 p-1.5 text-left">위험</th>
                <th className="border border-zinc-300 p-1.5 text-left">의무</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((s) => (
                <tr key={s.id}>
                  <td className="border border-zinc-300 p-1.5">{s.name}</td>
                  <td className="border border-zinc-300 p-1.5">
                    {s.modelProvider}
                    {s.modelName ? ` / ${s.modelName}` : ""}
                  </td>
                  <td className="border border-zinc-300 p-1.5">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        s.derivedRiskTier === "high"
                          ? "print-badge-high"
                          : s.derivedRiskTier === "medium"
                            ? "print-badge-medium"
                            : "print-badge-low"
                      }`}
                    >
                      {s.derivedRiskTier}
                    </span>
                  </td>
                  <td className="border border-zinc-300 p-1.5 text-[10px]">
                    {s.triggeredObligations.join(", ") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <footer className="mt-6 pt-3 border-t border-zinc-300 text-[10px] print-muted text-center">
          본 리포트는 한국 AI기본법(2026.1.22 시행) 기준으로 자동 생성된 초안이며,
          최종 컴플라이언스 판단은 법무 검토를 통해 확정되어야 합니다.
        </footer>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="print-section mb-6">
      <h2 className="text-base font-bold mb-2 pb-1 border-b border-zinc-300">{title}</h2>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <th className="border border-zinc-300 bg-zinc-50 p-1.5 text-left w-32 align-top">
        {k}
      </th>
      <td className="border border-zinc-300 p-1.5">{v}</td>
    </tr>
  );
}

function DefRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="text-xs mt-1.5">
      <strong>{k}:</strong> <span className="print-muted">{v}</span>
    </div>
  );
}

function DefList({ k, items }: { k: string; items: string[] }) {
  return (
    <div className="text-xs mt-1.5">
      <strong>{k}:</strong>
      <ul className="list-disc list-inside ml-2 print-muted">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function RoadmapTable({
  title,
  items,
}: {
  title: string;
  items: { title: string; owner: string; effort: string; relatedObligations: string[] }[];
}) {
  return (
    <div className="print-section mb-3">
      <div className="text-sm font-semibold mb-1">
        {title} · {items.length}건
      </div>
      {items.length === 0 ? (
        <div className="text-xs print-muted">(해당 항목 없음)</div>
      ) : (
        <table className="w-full text-xs border border-zinc-300">
          <thead className="bg-zinc-100">
            <tr>
              <th className="border border-zinc-300 p-1.5 text-left">액션</th>
              <th className="border border-zinc-300 p-1.5 w-20 text-left">담당</th>
              <th className="border border-zinc-300 p-1.5 w-20 text-left">공수</th>
              <th className="border border-zinc-300 p-1.5 w-32 text-left">관련 의무</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a, i) => (
              <tr key={i}>
                <td className="border border-zinc-300 p-1.5">{a.title}</td>
                <td className="border border-zinc-300 p-1.5">
                  {OWNER_LABEL[a.owner] ?? a.owner}
                </td>
                <td className="border border-zinc-300 p-1.5">
                  {EFFORT_LABEL[a.effort] ?? a.effort}
                </td>
                <td className="border border-zinc-300 p-1.5 text-[10px]">
                  {a.relatedObligations.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
