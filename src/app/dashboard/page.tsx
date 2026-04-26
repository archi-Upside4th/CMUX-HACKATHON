"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listEntries,
  deleteEntry,
  clearAll,
  type HistoryEntry,
} from "@/lib/storage/history";
import { Icon } from "@/components/Icon";

const RISK_DOT: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
  none: "bg-slate-300",
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
    if (!confirm("삭제할까요?")) return;
    deleteEntry(id);
    refresh();
  }

  function onClearAll() {
    if (!confirm("전체 삭제할까요?")) return;
    clearAll();
    refresh();
  }

  const filtered =
    filter === "all" ? entries : entries.filter((e) => e.type === filter);

  const scanCount = entries.filter((e) => e.type === "scan").length;
  const diagnoseCount = entries.filter((e) => e.type === "diagnose").length;
  const highRiskCount = entries.filter((e) => e.overallRisk === "high").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 pt-6 pb-16">
      <header className="mb-10">
        <h1 className="text-[44px] sm:text-[56px] font-semibold tracking-[-0.02em] leading-none text-slate-900">
          대시보드
        </h1>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        <ActionCard
          href="/scan"
          title="스캔"
          caption="GitHub 저장소 분석"
          iconName="scan"
        />
        <ActionCard
          href="/"
          title="진단"
          caption="회사 프로필 진단"
          iconName="clipboard"
        />
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <Stat label="이력" value={entries.length} />
        <Stat label="스캔" value={scanCount} />
        <Stat label="진단" value={diagnoseCount} />
        <Stat label="HIGH" value={highRiskCount} highlight={highRiskCount > 0} />
      </section>

      <section className="rounded-3xl bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1 text-[13px]">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
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
              className="text-[12px] text-slate-400 hover:text-rose-600 transition"
            >
              전체 삭제
            </button>
          )}
        </div>

        {!hydrated ? (
          <div className="text-sm text-slate-400 py-12 text-center">로딩…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface-2)] p-12 text-center text-sm text-slate-400">
            이력 없음
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((e) => (
              <li
                key={e.id}
                className="py-4 flex items-center justify-between gap-3 group"
              >
                <Link
                  href={`/dashboard/${e.id}`}
                  className="min-w-0 flex-1 flex items-center gap-3 hover:opacity-80 transition"
                >
                  <span
                    className={`shrink-0 h-2 w-2 rounded-full ${RISK_DOT[e.overallRisk] ?? RISK_DOT.none}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400">
                        {e.type === "scan" ? "스캔" : "진단"}
                      </span>
                      <span className="text-[11px] text-slate-300">·</span>
                      <span className="text-[11px] text-slate-400">
                        {fmtDate(e.createdAt)}
                      </span>
                    </div>
                    <div className="text-[15px] text-slate-900 truncate">
                      {e.title}
                    </div>
                  </div>
                  <span className="hidden sm:inline text-[12px] text-slate-400 tabular-nums shrink-0">
                    {e.type === "scan"
                      ? `시스템 ${e.systemCount ?? 0}`
                      : `의무 ${e.obligationCount ?? 0}`}
                  </span>
                  <span className="text-slate-300 group-hover:text-slate-900 group-hover:translate-x-0.5 transition">
                    <Icon name="arrow-right" size={18} />
                  </span>
                </Link>
                <button
                  onClick={() => onDelete(e.id)}
                  className="shrink-0 p-1.5 rounded-full text-slate-300 hover:bg-slate-100 hover:text-rose-600 transition"
                  aria-label="삭제"
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ActionCard({
  href,
  title,
  caption,
  iconName,
}: {
  href: string;
  title: string;
  caption: string;
  iconName: "scan" | "clipboard";
}) {
  return (
    <Link
      href={href}
      className="group rounded-3xl bg-slate-900 text-white p-7 flex items-center justify-between hover:bg-black transition"
    >
      <div className="flex items-center gap-4">
        <span className="grid place-items-center h-10 w-10 rounded-full bg-white/10 text-white">
          <Icon name={iconName} size={20} />
        </span>
        <div>
          <div className="text-[20px] font-semibold tracking-tight">{title}</div>
          <div className="text-[12px] text-white/55">{caption}</div>
        </div>
      </div>
      <span className="grid place-items-center h-9 w-9 rounded-full bg-white text-slate-900 group-hover:translate-x-0.5 transition">
        <Icon name="arrow-up-right" size={16} />
      </span>
    </Link>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-3xl bg-white p-5">
      <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">
        {label}
      </div>
      <div
        className={`text-[40px] font-semibold tabular-nums leading-none tracking-tight ${
          highlight ? "text-rose-600" : "text-slate-900"
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
      className={`px-3.5 py-1.5 rounded-full transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
