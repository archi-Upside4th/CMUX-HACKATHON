"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getEntry, type HistoryEntry } from "@/lib/storage/history";
import { ScanResultView } from "@/app/scan/page";
import type { DiagnosisResult, CompanyProfile } from "@/lib/types";
import { CitationsBlock, VerifiedBadge } from "@/components/CitationsBlock";
import { obligationSourceUrl } from "@/lib/laws/labels";
import { Icon } from "@/components/Icon";

const RISK_PILL: Record<string, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
  none: "bg-slate-100 text-slate-600",
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
      <main className="mx-auto w-full max-w-5xl px-6 pt-6 pb-16 text-sm text-slate-400">
        로딩…
      </main>
    );
  }

  if (!entry) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 pt-6 pb-16">
        <div className="rounded-3xl bg-[var(--surface-2)] p-12 text-center text-sm text-slate-400">
          이력 없음
          <div className="mt-4">
            <Link
              href="/dashboard"
              className="text-slate-900 hover:opacity-70 transition"
            >
              ← 대시보드
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pt-6 pb-16">
      <header className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-900 transition mb-4"
        >
          ← 대시보드
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-400">
            {entry.type === "scan" ? "스캔" : "진단"}
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${RISK_PILL[entry.overallRisk] ?? RISK_PILL.none}`}
          >
            {entry.overallRisk.toUpperCase()}
          </span>
          <span className="text-[11px] text-slate-400">
            {new Date(entry.createdAt).toLocaleString("ko-KR")}
          </span>
        </div>
        <h1 className="text-[28px] sm:text-[36px] font-semibold tracking-tight break-words text-slate-900">
          {entry.title}
        </h1>
      </header>

      {entry.type === "scan" ? (
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
    <div className="space-y-3">
      <div className="rounded-3xl bg-white p-7">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-4">
          프로필
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px]">
          <Pair k="회사" v={profile.name} />
          <Pair k="업종" v={profile.industry} />
          <Pair k="임직원" v={`${profile.employeeCount}명`} />
          <Pair
            k="연매출"
            v={`${profile.annualRevenueKRW.toLocaleString("ko-KR")}원`}
          />
          <Pair k="AI" v={profile.aiUsages.join(", ")} full />
          <Pair k="해외 AI" v={profile.usesForeignAI ? "예" : "아니오"} />
          {profile.notes && <Pair k="메모" v={profile.notes} full />}
        </div>
      </div>

      <div className="rounded-3xl bg-white p-7">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] uppercase tracking-wider text-slate-400">
            전체 위험
          </span>
          <span
            className={`text-[12px] px-3 py-1 rounded-full font-medium ${RISK_PILL[result.overallRisk]}`}
          >
            {result.overallRisk.toUpperCase()}
          </span>
        </div>
        <p className="text-[14px] text-slate-800 leading-relaxed">
          {result.summary}
        </p>
      </div>

      <div className="rounded-3xl bg-white p-7">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-3">
          최우선 조치
        </div>
        <ol className="space-y-2.5">
          {result.recommendedNextSteps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[14px] text-slate-800">
              <span className="shrink-0 grid place-items-center h-5 w-5 rounded-full bg-slate-900 text-white text-[11px] font-medium tabular-nums">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 px-1">
          조항별
        </div>
        {result.items.map((item) => (
          <article key={item.obligationId} className="rounded-3xl bg-white p-6">
            <header className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-slate-900">
                  {item.title}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {item.legalBasis}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                <VerifiedBadge verified={item.verified} />
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${APP_PILL[item.applicability]}`}
                >
                  {APP_LABEL[item.applicability]}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${RISK_PILL[item.riskLevel]}`}
                >
                  {item.riskLevel.toUpperCase()}
                </span>
              </div>
            </header>
            <p className="text-[13.5px] text-slate-700 leading-relaxed mb-3">
              {item.reasoning}
            </p>

            <details className="mb-3" open={item.applicability === "applicable"}>
              <summary className="cursor-pointer text-[12px] text-slate-500 hover:text-slate-900 transition list-none flex items-center gap-1">
                <Icon name="chevron-right" size={12} />
                근거 조문 ({item.citations.length})
              </summary>
              <div className="mt-3">
                <CitationsBlock
                  citations={item.citations}
                  obligationId={item.obligationId}
                />
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
              </div>
            </details>

            {item.actionItems.length > 0 && (
              <ul className="space-y-1.5">
                {item.actionItems.map((a, i) => (
                  <li key={i} className="text-[13px] text-slate-800 flex gap-2.5">
                    <Icon
                      name="check"
                      size={14}
                      className="text-slate-400 mt-0.5 shrink-0"
                    />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
              <span>{item.deadline}</span>
              {item.evidenceTypes.length > 0 && (
                <span className="truncate">
                  {item.evidenceTypes.join(" · ")}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Pair({ k, v, full }: { k: string; v: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
        {k}
      </div>
      <div className="text-slate-900">{v}</div>
    </div>
  );
}
