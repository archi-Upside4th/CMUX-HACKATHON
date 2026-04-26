"use client";

import { useEffect, useState, use } from "react";
import { getEntry, type HistoryEntry } from "@/lib/storage/history";
import type {
  ServiceProfile,
  ComplianceReport,
  ReportCitation,
} from "@/lib/report/schema";
import {
  obligationArticle,
  obligationExcerpts,
  obligationPenalty,
  obligationSourceUrl,
} from "@/lib/laws/labels";

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

function documentNumber(id: string, createdAt: string): string {
  const d = new Date(createdAt);
  const yyyymmdd =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  const seq = id.slice(-6).toUpperCase();
  return `LEXOS-AIBA-${yyyymmdd}-${seq}`;
}

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

  return (
    <PrintableReport
      payload={payload}
      createdAt={entry.createdAt}
      docNo={documentNumber(entry.id, entry.createdAt)}
    />
  );
}

function PrintableReport({
  payload,
  createdAt,
  docNo,
}: {
  payload: ScanPayload;
  createdAt: string;
  docNo: string;
}) {
  const { report, serviceProfile: profile, systems, repoUrl, commitSha } = payload;
  if (!report || !profile) return null;
  const systemNameById = new Map(systems.map((s) => [s.id, s.name]));
  const applicable = report.obligationDeepDive.filter(
    (o) => o.applicability !== "not_applicable"
  );
  const verifiedCount = applicable.filter((o) => o.verified).length;
  const allVerified = applicable.length > 0 && verifiedCount === applicable.length;
  const createdLabel = new Date(createdAt).toLocaleString("ko-KR");

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 22mm 18mm 18mm 18mm;
          }
          body {
            background: white !important;
            color: #111 !important;
            font-family: "Times New Roman", "Nanum Myeongjo", serif !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page {
            background: white !important;
            color: #111 !important;
          }
          .print-section,
          .print-card,
          .print-citation,
          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-page-break {
            page-break-after: always;
            break-after: page;
          }
          .print-h1 {
            color: #000;
          }
          .print-meta {
            color: #555;
          }
          .print-card {
            border: 1px solid #999;
            background: white;
            color: #111;
          }
          .print-citation {
            background: #f7f7f2 !important;
            border-left: 3px solid #444 !important;
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

      <div className="no-print sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="text-sm text-zinc-300">
          공식 보고서 미리보기 — 인쇄/PDF 저장 다이얼로그에서 "배경 그래픽"을 켜세요.
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-indigo-500 hover:bg-indigo-400 px-4 py-2 text-sm font-medium text-white transition"
        >
          공식 인쇄 / PDF 저장
        </button>
      </div>

      <main className="print-page mx-auto w-full max-w-[820px] px-10 py-8 bg-white text-zinc-900 print:px-0 print:py-0">
        <CoverPage
          docNo={docNo}
          createdLabel={createdLabel}
          servicePurpose={profile.servicePurpose}
          repoUrl={repoUrl}
          commitSha={commitSha}
          overallRisk={report.overallRisk}
          allVerified={allVerified}
          verifiedCount={verifiedCount}
          applicableCount={applicable.length}
        />

        <TableOfContents
          obligationCount={report.obligationDeepDive.length}
          riskCount={report.riskRegister.length}
          systemCount={report.systemAnalyses.length}
        />

        <Section n="1" title="Executive Summary">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {report.executiveSummary}
          </p>
        </Section>

        <Section n="2" title="서비스 프로파일">
          <table className="w-full text-xs border border-zinc-300">
            <tbody>
              <Row k="서비스 목적" v={profile.servicePurpose} />
              <Row k="사용자 유형" v={profile.userTypes.join(", ")} />
              <Row k="주요 도메인" v={profile.primaryDomain} />
              <Row k="데이터 민감도" v={profile.dataSensitivity} />
              <Row k="처리 데이터" v={profile.dataKinds.join(", ") || "-"} />
              <Row k="결정 자동화" v={profile.decisionAutomation} />
              <Row k="외부 사용자 노출" v={profile.customerExposure ? "예" : "아니오"} />
            </tbody>
          </table>
          <p className="text-xs mt-2 print-muted">
            <strong>판단 근거:</strong> {profile.reasoning}
          </p>
        </Section>

        <Section n="3" title={`리스크 레지스터 (${report.riskRegister.length}건)`}>
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

        <Section n="4" title={`시스템 분석 (${report.systemAnalyses.length}개)`}>
          {report.systemAnalyses.map((sa) => (
            <div
              key={sa.systemId}
              className="print-section mb-4 print-card rounded p-3"
            >
              <div className="font-semibold text-sm mb-1">
                {systemNameById.get(sa.systemId) ?? sa.systemId}
                <span className="text-xs print-muted font-normal ml-2">
                  — {sa.role}
                </span>
              </div>
              <DefRow k="데이터 흐름" v={sa.dataFlow} />
              {sa.crossSystemInteractions.length > 0 && (
                <DefRow
                  k="시스템 간 상호작용"
                  v={sa.crossSystemInteractions.join(" / ")}
                />
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

        <Section n="5" title={`의무 심화 분석 (${report.obligationDeepDive.length}/9)`}>
          <p className="text-[11px] print-muted mb-3">
            각 의무 항목의 "근거 조문 인용"은 본 시스템의 RAG corpus(국가법령정보센터 발췌)와
            substring 일치 검증을 통과한 텍스트입니다. ✗ 표시는 검증 실패를
            의미하며 법무 재확인이 필요합니다.
          </p>
          {report.obligationDeepDive.map((o) => (
            <div
              key={o.obligationId}
              className="print-section mb-3 print-card rounded p-3"
            >
              <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded border ${
                    o.verified
                      ? "border-green-700 text-green-800"
                      : "border-red-700 text-red-800"
                  }`}
                >
                  {o.verified ? "✓ 조문 검증됨" : "✗ 미검증"}
                </span>
                <span className="text-[10px] print-muted font-mono ml-auto">
                  {o.obligationId}
                </span>
              </div>
              <div className="text-[11px] print-muted mb-2">
                {obligationArticle(o.obligationId)}
              </div>
              <DefRow k="판단 근거" v={o.rationale} />

              <div className="text-xs mt-1.5">
                <strong>근거 조문 인용:</strong>
                <CitationsForPrint
                  citations={o.citations}
                  obligationId={o.obligationId}
                />
                {obligationSourceUrl(o.obligationId) && (
                  <div className="text-[10px] print-muted mt-1">
                    원문 출처: {obligationSourceUrl(o.obligationId)}
                  </div>
                )}
                {obligationPenalty(o.obligationId) && (
                  <div className="text-[10px] mt-1 text-red-800">
                    제재: {obligationPenalty(o.obligationId)}
                  </div>
                )}
              </div>

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

        <Section n="6" title="이행 로드맵">
          <RoadmapTable title="P1 긴급 (30일)" items={report.roadmap.p1_urgent} />
          <RoadmapTable
            title="P2 중요 (90일, 시행일 전)"
            items={report.roadmap.p2_important}
          />
          <RoadmapTable title="P3 계획 (분기)" items={report.roadmap.p3_planned} />
        </Section>

        {report.openQuestions.length > 0 && (
          <Section
            n="7"
            title={`정보 부족 / 인간 결정 필요 (${report.openQuestions.length})`}
          >
            <ol className="text-sm space-y-1 list-decimal list-inside">
              {report.openQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </Section>
        )}

        <Section n="8" title="검토 및 승인">
          <SignatureBlock />
        </Section>

        <Section n="9" title="문서 변경 이력">
          <table className="w-full text-xs border border-zinc-300">
            <thead className="bg-zinc-100">
              <tr>
                <th className="border border-zinc-300 p-1.5 w-16 text-left">버전</th>
                <th className="border border-zinc-300 p-1.5 w-32 text-left">일시</th>
                <th className="border border-zinc-300 p-1.5 text-left">변경 내용</th>
                <th className="border border-zinc-300 p-1.5 w-24 text-left">작성자</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-zinc-300 p-1.5">v1.0</td>
                <td className="border border-zinc-300 p-1.5">{createdLabel}</td>
                <td className="border border-zinc-300 p-1.5">최초 자동 생성 (LexOS RAG 진단)</td>
                <td className="border border-zinc-300 p-1.5">LexOS</td>
              </tr>
              {[1, 2].map((i) => (
                <tr key={i}>
                  <td className="border border-zinc-300 p-1.5">&nbsp;</td>
                  <td className="border border-zinc-300 p-1.5">&nbsp;</td>
                  <td className="border border-zinc-300 p-1.5">&nbsp;</td>
                  <td className="border border-zinc-300 p-1.5">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section n="부록 A" title="검출된 AI 시스템 목록">
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

        <Section n="부록 B" title="법령 원문 출처 및 발췌 코퍼스">
          <p className="text-xs print-muted mb-2">
            본 보고서의 모든 인용은 아래 출처를 substring 일치로 검증하였습니다.
          </p>
          <table className="w-full text-xs border border-zinc-300">
            <thead className="bg-zinc-100">
              <tr>
                <th className="border border-zinc-300 p-1.5 w-32 text-left">의무 ID</th>
                <th className="border border-zinc-300 p-1.5 text-left">조항</th>
                <th className="border border-zinc-300 p-1.5 w-32 text-left">출처</th>
              </tr>
            </thead>
            <tbody>
              {[...new Set(report.obligationDeepDive.map((o) => o.obligationId))].map(
                (id) => {
                  const url = obligationSourceUrl(id);
                  const exc = obligationExcerpts(id);
                  return (
                    <tr key={id}>
                      <td className="border border-zinc-300 p-1.5 font-mono text-[10px] align-top">
                        {id}
                      </td>
                      <td className="border border-zinc-300 p-1.5 align-top">
                        <div className="font-medium">{obligationArticle(id)}</div>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside text-[10px] print-muted">
                          {exc.map((e) => (
                            <li key={e.locator}>
                              <span className="font-mono">{e.locator}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="border border-zinc-300 p-1.5 text-[10px] align-top break-all">
                        {url ?? "-"}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </Section>

        <footer className="mt-8 pt-3 border-t border-zinc-400 text-[10px] print-muted">
          <div className="flex justify-between">
            <span>
              문서번호 {docNo} · 페이지 자동 (브라우저 인쇄 기능 사용)
            </span>
            <span>기밀등급: 사내 한정 (Internal Use Only)</span>
          </div>
          <p className="mt-2">
            본 리포트는 한국 AI기본법(2026.1.22 시행) 기준으로 LexOS가 자동 생성한
            초안이며, 모든 인용은 RAG corpus와의 substring 일치 검증을 거쳤습니다.
            최종 컴플라이언스 판단은 반드시 법무 검토를 통해 확정되어야 합니다.
          </p>
        </footer>
      </main>
    </>
  );
}

function CoverPage({
  docNo,
  createdLabel,
  servicePurpose,
  repoUrl,
  commitSha,
  overallRisk,
  allVerified,
  verifiedCount,
  applicableCount,
}: {
  docNo: string;
  createdLabel: string;
  servicePurpose: string;
  repoUrl: string;
  commitSha: string;
  overallRisk: "high" | "medium" | "low";
  allVerified: boolean;
  verifiedCount: number;
  applicableCount: number;
}) {
  return (
    <section className="print-section print-page-break mb-10 pb-6 border-b-2 border-zinc-800">
      <div className="text-[10px] print-meta uppercase tracking-[0.25em] mb-1">
        Confidential · Internal Use Only
      </div>
      <div className="text-[11px] print-meta uppercase tracking-wider mb-1">
        AI 기본법 컴플라이언스 보고서
      </div>
      <h1 className="print-h1 text-3xl font-bold leading-tight mb-1">
        {servicePurpose}
      </h1>
      <div className="text-sm print-meta mb-6">
        Korean AI Framework Act Compliance Report
      </div>

      <table className="w-full text-xs border border-zinc-400">
        <tbody>
          <Row k="문서번호" v={docNo} />
          <Row k="문서버전" v="v1.0 (자동 생성)" />
          <Row k="작성일시" v={createdLabel} />
          <Row k="작성주체" v="LexOS Compliance Engine (RAG-grounded)" />
          <Row k="대상 저장소" v={repoUrl} />
          <Row k="대상 커밋" v={commitSha.slice(0, 12)} />
          <Row k="기준 법령" v="인공지능 발전과 신뢰 기반 조성 등에 관한 법률 (2026.1.22 시행)" />
          <Row k="기밀등급" v="사내 한정 (Internal Use Only)" />
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="print-card p-3 rounded">
          <div className="text-[10px] print-meta uppercase tracking-wider mb-1">
            전체 위험도
          </div>
          <div
            className={`inline-block px-3 py-1 rounded text-sm font-bold ${
              overallRisk === "high"
                ? "print-badge-high"
                : overallRisk === "medium"
                  ? "print-badge-medium"
                  : "print-badge-low"
            }`}
          >
            {overallRisk.toUpperCase()}
          </div>
        </div>
        <div className="print-card p-3 rounded">
          <div className="text-[10px] print-meta uppercase tracking-wider mb-1">
            RAG 인용 검증
          </div>
          <div
            className={`inline-block px-3 py-1 rounded text-sm font-bold ${
              allVerified ? "print-badge-low" : "print-badge-medium"
            }`}
          >
            {verifiedCount}/{applicableCount}{" "}
            {allVerified ? "통과" : "(일부 미검증)"}
          </div>
        </div>
      </div>

      <p className="mt-6 text-[11px] print-muted leading-relaxed">
        본 문서는 LexOS가 정적 코드 분석과 검증된 법령 코퍼스(국가법령정보센터)에
        근거해 자동 생성한 초안입니다. 자동화된 추론이며 법적 자문이 아닙니다.
        모든 의무 인용은 RAG corpus와 substring 일치로 검증되었으며, 검증 실패
        항목은 보고서 본문에 ✗ 표시됩니다. 최종 판단은 법무 검토를 거쳐 확정해야
        합니다.
      </p>
    </section>
  );
}

function TableOfContents({
  obligationCount,
  riskCount,
  systemCount,
}: {
  obligationCount: number;
  riskCount: number;
  systemCount: number;
}) {
  const toc = [
    "1. Executive Summary",
    "2. 서비스 프로파일",
    `3. 리스크 레지스터 (${riskCount}건)`,
    `4. 시스템 분석 (${systemCount}개)`,
    `5. 의무 심화 분석 (${obligationCount}/9)`,
    "6. 이행 로드맵",
    "7. 정보 부족 / 인간 결정 필요",
    "8. 검토 및 승인",
    "9. 문서 변경 이력",
    "부록 A. 검출된 AI 시스템 목록",
    "부록 B. 법령 원문 출처 및 발췌 코퍼스",
  ];
  return (
    <section className="print-section print-page-break mb-8">
      <h2 className="text-base font-bold mb-3 pb-1 border-b border-zinc-400">
        목차 (Table of Contents)
      </h2>
      <ul className="text-sm space-y-1.5">
        {toc.map((t, i) => (
          <li key={i} className="flex items-baseline">
            <span>{t}</span>
            <span className="flex-1 mx-2 border-b border-dotted border-zinc-400 translate-y-[-3px]" />
            <span className="print-muted text-xs">—</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CitationsForPrint({
  citations,
}: {
  citations: ReportCitation[];
  obligationId: string;
}) {
  if (citations.length === 0) {
    return (
      <div className="mt-1 text-[11px] text-red-800 italic">
        ⚠ 인용 없음 — 법무 재검토 필수.
      </div>
    );
  }
  return (
    <ul className="mt-1 space-y-1.5">
      {citations.map((c, i) => (
        <li
          key={i}
          className={`print-citation rounded p-2 text-[11px] leading-snug ${
            c.verifiedLocator
              ? "border-l-4 border-green-700 bg-green-50"
              : "border-l-4 border-red-700 bg-red-50"
          }`}
        >
          <div className="font-mono text-[10px] mb-0.5">
            {c.verifiedLocator
              ? `✓ ${c.verifiedLocator}`
              : "✗ 미검증 — corpus 미일치"}
          </div>
          <div className="text-zinc-900">"{c.text}"</div>
        </li>
      ))}
    </ul>
  );
}

function SignatureBlock() {
  const roles = [
    { role: "작성자 (자동)", name: "LexOS Compliance Engine" },
    { role: "검토자 (법무)", name: "" },
    { role: "검토자 (보안)", name: "" },
    { role: "승인자 (CISO/CPO)", name: "" },
    { role: "최종 결재 (대표이사)", name: "" },
  ];
  return (
    <table className="w-full text-xs border border-zinc-400">
      <thead className="bg-zinc-100">
        <tr>
          <th className="border border-zinc-400 p-2 w-40 text-left">역할</th>
          <th className="border border-zinc-400 p-2 text-left">성명</th>
          <th className="border border-zinc-400 p-2 w-32 text-left">검토일</th>
          <th className="border border-zinc-400 p-2 w-40 text-left">서명</th>
        </tr>
      </thead>
      <tbody>
        {roles.map((r) => (
          <tr key={r.role}>
            <td className="border border-zinc-400 p-2 align-top">{r.role}</td>
            <td className="border border-zinc-400 p-2 align-top h-12">{r.name}</td>
            <td className="border border-zinc-400 p-2 align-top">&nbsp;</td>
            <td className="border border-zinc-400 p-2 align-top">&nbsp;</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="print-section mb-6">
      <h2 className="text-base font-bold mb-2 pb-1 border-b border-zinc-400">
        <span className="font-mono text-zinc-600 mr-2">{n}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <th className="border border-zinc-300 bg-zinc-50 p-1.5 text-left w-32 align-top font-medium">
        {k}
      </th>
      <td className="border border-zinc-300 p-1.5 break-all">{v}</td>
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
