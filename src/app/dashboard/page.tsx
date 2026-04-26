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
  high: "bg-red-500/20 text-red-300 border border-red-500/40",
  medium: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  low: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  none: "bg-zinc-700/40 text-zinc-300 border border-zinc-600",
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
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-sm text-zinc-400">
          최근 스캔/진단 이력을 한눈에. (브라우저 localStorage 저장 — 최신 50건)
        </p>
      </header>

      {/* 빠른 진입 카드 */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/scan"
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-indigo-400 hover:bg-indigo-500/5 p-6 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">코드 스캔</h2>
            <span className="text-zinc-500 group-hover:text-indigo-300 transition">
              →
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            GitHub URL 한 줄로 AI 시스템 식별 + 의무 매핑.
          </p>
        </Link>

        <Link
          href="/"
          className="group rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-indigo-400 hover:bg-indigo-500/5 p-6 transition"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">회사 진단</h2>
            <span className="text-zinc-500 group-hover:text-indigo-300 transition">
              →
            </span>
          </div>
          <p className="text-sm text-zinc-400">
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
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
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
              className="text-xs text-zinc-500 hover:text-red-400 transition"
            >
              전체 삭제
            </button>
          )}
        </div>

        {!hydrated ? (
          <div className="text-sm text-zinc-500 py-8 text-center">로딩…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-zinc-500 text-sm">
            {entries.length === 0
              ? "아직 이력이 없습니다. 위 카드에서 스캔 또는 진단을 시작하세요."
              : "필터에 해당하는 이력이 없습니다."}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800">
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
                          ? "bg-indigo-500/15 text-indigo-300"
                          : "bg-fuchsia-500/15 text-fuchsia-300"
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
                    <span className="text-xs text-zinc-500">
                      {fmtDate(e.createdAt)}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-200 truncate">{e.title}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {e.type === "scan"
                      ? `시스템 ${e.systemCount ?? 0}개`
                      : `의무 ${e.obligationCount ?? 0}개 적용`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/dashboard/${e.id}`}
                    className="text-xs text-indigo-300 hover:text-indigo-200 underline underline-offset-2"
                  >
                    보기
                  </Link>
                  <button
                    onClick={() => onDelete(e.id)}
                    className="text-xs text-zinc-500 hover:text-red-400 transition"
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
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div
        className={`text-2xl font-semibold ${
          accent === "red" && value > 0 ? "text-red-300" : "text-zinc-100"
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
          ? "border-indigo-400 bg-indigo-500/15 text-indigo-100"
          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500"
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
