"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listEntries,
  deleteEntry,
  clearAll,
  type HistoryEntry,
} from "@/lib/storage/history";

const RISK_BADGE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border border-rose-200",
  medium: "bg-amber-50 text-amber-700 border border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  none: "bg-slate-100 text-slate-600 border border-slate-200",
};

export default function DashboardPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState<"all" | "scan" | "diagnose">("all");

  useEffect(() => {
    setEntries(listEntries());
    setHydrated(true);
  }, []);

  function refresh() {
    setEntries(listEntries());
  }

  function onDelete(id: string) {
    if (!confirm("이 이력을 삭제할까요?")) return;
    deleteEntry(id);
    refresh();
  }

  function onClearAll() {
    if (!confirm("모든 이력을 삭제할까요? (되돌릴 수 없음)")) return;
    clearAll();
    refresh();
  }

  const filtered =
    filter === "all" ? entries : entries.filter((e) => e.type === filter);

  const scanCount = entries.filter((e) => e.type === "scan").length;
  const diagnoseCount = entries.filter((e) => e.type === "diagnose").length;
  const highRiskCount = entries.filter((e) => e.overallRisk === "high").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-600 mb-1">
              LexOS · AI 기본법 컴플라이언스
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              대시보드
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              최근 스캔/진단 이력을 한눈에. (브라우저 localStorage 저장 — 최신 50건)
            </p>
          </div>
        </div>
      </header>

      {/* 빠른 진입 카드 */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/scan"
          className="card-hover group rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 p-6 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-sm shadow-indigo-200">
                ⌘
              </span>
              <h2 className="text-lg font-semibold">코드 스캔</h2>
            </div>
            <span className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition">
              →
            </span>
          </div>
          <p className="text-sm text-slate-500">
            GitHub URL 한 줄로 AI 시스템 식별 + 의무 매핑.
          </p>
        </Link>

        <Link
          href="/"
          className="card-hover group rounded-2xl border border-slate-200 bg-white hover:border-fuchsia-300 p-6 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center h-9 w-9 rounded-lg bg-gradient-to-br from-fuchsia-500 to-rose-500 text-white shadow-sm shadow-fuchsia-200">
                ✦
              </span>
              <h2 className="text-lg font-semibold">회사 진단</h2>
            </div>
            <span className="text-slate-400 group-hover:text-fuchsia-600 group-hover:translate-x-0.5 transition">
              →
            </span>
          </div>
          <p className="text-sm text-slate-500">
            회사 프로필 입력 → Gemini가 9개 의무별 적용 여부 매핑.
          </p>
        </Link>
      </section>

      {/* KPI */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="총 이력" value={entries.length} />
        <Kpi label="코드 스캔" value={scanCount} />
        <Kpi label="회사 진단" value={diagnoseCount} />
        <Kpi label="HIGH 위험" value={highRiskCount} accent="red" />
      </section>

      {/* 필터 + 이력 */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2 text-sm">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
            >
              전체
            </FilterChip>
            <FilterChip
              active={filter === "scan"}
              onClick={() => setFilter("scan")}
            >
              스캔
            </FilterChip>
            <FilterChip
              active={filter === "diagnose"}
              onClick={() => setFilter("diagnose")}
            >
              진단
            </FilterChip>
          </div>
          {entries.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-slate-400 hover:text-rose-600 transition"
            >
              전체 삭제
            </button>
          )}
        </div>

        {!hydrated ? (
          <div className="text-sm text-slate-400 py-8 text-center">로딩…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-400 text-sm">
            {entries.length === 0
              ? "아직 이력이 없습니다. 위 카드에서 스캔 또는 진단을 시작하세요."
              : "필터에 해당하는 이력이 없습니다."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filtered.map((e) => (
              <li
                key={e.id}
                className="py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        e.type === "scan"
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-fuchsia-100 text-fuchsia-700"
                      }`}
                    >
                      {e.type === "scan" ? "스캔" : "진단"}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        RISK_BADGE[e.overallRisk] ?? RISK_BADGE.none
                      }`}
                    >
                      {e.overallRisk.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400">
                      {fmtDate(e.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm text-slate-800 truncate">{e.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {e.type === "scan"
                      ? `시스템 ${e.systemCount ?? 0}개`
                      : `의무 ${e.obligationCount ?? 0}개 적용`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/dashboard/${e.id}`}
                    className="text-xs text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
                  >
                    보기
                  </Link>
                  <button
                    onClick={() => onDelete(e.id)}
                    className="text-xs text-slate-400 hover:text-rose-600 transition"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "red";
}) {
  const danger = accent === "red" && value > 0;
  return (
    <div
      className={`card-hover rounded-2xl border p-4 ${
        danger
          ? "border-rose-200 bg-gradient-to-br from-rose-50 to-white"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </div>
      <div
        className={`text-3xl font-semibold tabular-nums ${
          danger ? "text-rose-600" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md border transition ${
        active
          ? "border-indigo-500 bg-indigo-100 text-indigo-700"
          : "border-slate-300 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-700"
      }`}
    >
      {children}
    </button>
  );
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
