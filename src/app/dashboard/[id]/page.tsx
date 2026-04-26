"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getEntry, type HistoryEntry } from "@/lib/storage/history";
import { ScanResultView } from "@/app/scan/page";
import type { DiagnosisResult, CompanyProfile } from "@/lib/types";

const RISK_BADGE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border border-rose-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  none: "bg-slate-100 text-slate-600 border border-slate-200",
};

const APP_BADGE: Record<string, string> = {
  applicable: "bg-rose-100 text-rose-700",
  conditional: "bg-amber-100 text-amber-700",
  not_applicable: "bg-slate-100 text-slate-500",
};

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    setEntry(getEntry(params.id));
    setHydrated(true);
  }, [params?.id]);

  if (!hydrated) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10 text-slate-400 text-sm">
        로딩…
      </main>
    );
  }

  if (!entry) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          이력을 찾을 수 없습니다.
          <div className="mt-3">
            <Link
              href="/dashboard"
              className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
            >
              ← 대시보드로
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-6">
        <nav className="text-sm mb-3">
          <Link
            href="/dashboard"
            className="text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
          >
            ← 대시보드
          </Link>
        </nav>
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              entry.type === "scan"
                ? "bg-indigo-100 text-indigo-700"
                : "bg-fuchsia-100 text-fuchsia-700"
            }`}
          >
            {entry.type === "scan" ? "스캔" : "진단"}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              RISK_BADGE[entry.overallRisk] ?? RISK_BADGE.none
            }`}
          >
            {entry.overallRisk.toUpperCase()}
          </span>
          <span className="text-xs text-slate-400">
            {new Date(entry.createdAt).toLocaleString("ko-KR")}
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight break-words">
          {entry.title}
        </h1>
      </header>

      {entry.type === "scan" ? (
        // ScanResultView 재사용 (savedId 전달 시 인쇄 버튼 노출)
        <ScanResultView
          result={entry.payload as Parameters<typeof ScanResultView>[0]["result"]}
          savedId={entry.id}
        />
      ) : (
        <DiagnoseDetail
          payload={
            entry.payload as { profile: CompanyProfile; result: DiagnosisResult }
          }
        />
      )}
    </main>
  );
}

function DiagnoseDetail({
  payload,
}: {
  payload: { profile: CompanyProfile; result: DiagnosisResult };
}) {
  const { profile, result } = payload;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold mb-2">회사 프로필 (스냅샷)</h2>
        <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
          <div>
            <span className="text-slate-400">회사명:</span> {profile.name}
          </div>
          <div>
            <span className="text-slate-400">업종:</span> {profile.industry}
          </div>
          <div>
            <span className="text-slate-400">임직원:</span>{" "}
            {profile.employeeCount}명
          </div>
          <div>
            <span className="text-slate-400">연매출:</span>{" "}
            {profile.annualRevenueKRW.toLocaleString("ko-KR")}원
          </div>
          <div className="col-span-2">
            <span className="text-slate-400">AI 사용:</span>{" "}
            {profile.aiUsages.join(", ")}
          </div>
          <div className="col-span-2">
            <span className="text-slate-400">해외 AI:</span>{" "}
            {profile.usesForeignAI ? "예" : "아니오"}
          </div>
          {profile.notes && (
            <div className="col-span-2">
              <span className="text-slate-400">메모:</span> {profile.notes}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">진단 결과</h2>
          <span
            className={`text-xs px-2 py-1 rounded-md ${
              RISK_BADGE[result.overallRisk]
            }`}
          >
            전체 위험: {result.overallRisk.toUpperCase()}
          </span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold mb-3">최우선 조치 (Top 3)</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-800">
          {result.recommendedNextSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">조항별 상세</h3>
        {result.items.map((item) => (
          <article
            key={item.obligationId}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <header className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="text-xs text-slate-400">{item.legalBasis}</div>
                <div className="font-semibold">{item.title}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    APP_BADGE[item.applicability]
                  }`}
                >
                  {item.applicability}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    RISK_BADGE[item.riskLevel]
                  }`}
                >
                  {item.riskLevel}
                </span>
              </div>
            </header>
            <p className="text-sm text-slate-700 leading-relaxed mb-3">
              {item.reasoning}
            </p>
            {item.actionItems.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-slate-500 mb-1">이행 체크리스트</div>
                <ul className="space-y-1">
                  {item.actionItems.map((a, i) => (
                    <li key={i} className="text-sm text-slate-800 flex gap-2">
                      <input type="checkbox" className="mt-1" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-3 pt-3 border-t border-slate-200">
              <div>
                <span className="text-slate-400">마감:</span> {item.deadline}
              </div>
              {item.evidenceTypes.length > 0 && (
                <div>
                  <span className="text-slate-400">증거:</span>{" "}
                  {item.evidenceTypes.join(", ")}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
