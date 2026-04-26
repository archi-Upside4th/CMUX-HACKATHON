"use client";

import { useEffect, useMemo, useState } from "react";
import { saveEntry } from "@/lib/storage/history";

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
  evidence: {
    catalogEntryIds: string[];
    ruleIds: string[];
    filePaths: string[];
  };
}

interface RefinedSystem {
  systemId: string;
  humanSummary: string;
  riskNarrative: string;
  mitigations: string[];
  priorityScore: number;
  gaps: string[];
}

interface ScanRefinement {
  overallSummary: string;
  topPriority: string;
  systems: RefinedSystem[];
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
  refinement: ScanRefinement | null;
  refineError: string | null;
}

const RISK_BADGE: Record<string, string> = {
  high: "bg-red-500/20 text-red-300 border border-red-500/40",
  medium: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  low: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
};

const CONF_BADGE: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  low: "bg-zinc-700/40 text-zinc-400",
};

const PRIORITY_BADGE: Record<number, { label: string; cls: string }> = {
  1: { label: "P1 긴급", cls: "bg-red-500/20 text-red-300 border border-red-500/40" },
  2: { label: "P2 높음", cls: "bg-orange-500/20 text-orange-300 border border-orange-500/40" },
  3: { label: "P3 중간", cls: "bg-amber-500/20 text-amber-300 border border-amber-500/40" },
  4: { label: "P4 낮음", cls: "bg-sky-500/20 text-sky-300 border border-sky-500/40" },
  5: { label: "P5 여유", cls: "bg-zinc-700/40 text-zinc-300 border border-zinc-600" },
};

function overallRiskOf(systems: AISystem[]): "high" | "medium" | "low" | "none" {
  if (systems.length === 0) return "none";
  if (systems.some((s) => s.derivedRiskTier === "high")) return "high";
  if (systems.some((s) => s.derivedRiskTier === "medium")) return "medium";
  return "low";
}

function uniqueObligations(systems: AISystem[]): string[] {
  return [...new Set(systems.flatMap((s) => s.triggeredObligations))];
}

export default function ScanPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);

  // 결과 도착 시 자동 저장
  useEffect(() => {
    if (!result) return;
    saveEntry({
      type: "scan",
      title: result.repoUrl,
      overallRisk: overallRiskOf(result.systems),
      systemCount: result.systems.length,
      payload: result,
    });
  }, [result]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
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
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">코드 스캔</h1>
        <p className="text-sm text-zinc-400">
          GitHub 저장소 코드 분석 → AI 시스템 식별 → AI기본법 의무 자동 매핑 + Gemini 서술 보강
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 mb-6 space-y-4"
      >
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">
            GitHub 저장소 URL (https://)
          </span>
          <input
            type="url"
            required
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <span className="block text-xs text-zinc-500 mt-1">
            github.com / gitlab.com / bitbucket.org / codeberg.org 만 허용. depth=1, blob ≤10MB.
          </span>
        </label>
        <button
          type="submit"
          disabled={loading || repoUrl.length === 0}
          className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:bg-zinc-700 disabled:text-zinc-400 px-4 py-3 font-medium transition"
        >
          {loading ? "스캔 중… (수집 → 분석 → 합성 → Gemini 서술)" : "코드 스캔 실행"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-200 mb-6">
          <strong className="block mb-1">오류</strong>
          <pre className="text-xs whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {result && <ScanResultView result={result} />}
    </main>
  );
}

export function ScanResultView({ result }: { result: ScanResponse }) {
  const overall = overallRiskOf(result.systems);
  const obligations = uniqueObligations(result.systems);

  // refinement.systems를 systemId → RefinedSystem 으로 색인
  const refineMap = useMemo(() => {
    const m = new Map<string, RefinedSystem>();
    if (result.refinement) {
      for (const r of result.refinement.systems) m.set(r.systemId, r);
    }
    return m;
  }, [result.refinement]);

  // 정렬: priority desc → risk desc
  const RISK_RANK = { high: 3, medium: 2, low: 1 } as const;
  const sortedSystems = useMemo(() => {
    return [...result.systems].sort((a, b) => {
      const ap = refineMap.get(a.id)?.priorityScore ?? 99;
      const bp = refineMap.get(b.id)?.priorityScore ?? 99;
      if (ap !== bp) return ap - bp;
      return RISK_RANK[b.derivedRiskTier] - RISK_RANK[a.derivedRiskTier];
    });
  }, [result.systems, refineMap]);

  return (
    <section className="space-y-6">
      {/* 상단 요약 배너 */}
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-indigo-500/5 to-fuchsia-500/5 p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xs text-zinc-500 mb-1">스캔 요약</div>
            <div className="text-sm text-zinc-300">
              <code className="text-xs">{result.repoUrl}</code>{" "}
              <span className="text-zinc-500">·</span>{" "}
              <code className="text-xs">{result.commitSha.slice(0, 12)}</code>
            </div>
          </div>
          {overall !== "none" && (
            <span className={`text-xs px-2 py-1 rounded ${RISK_BADGE[overall]}`}>
              전체 위험: {overall.toUpperCase()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="검출 시스템" value={`${result.systems.length}개`} />
          <Stat label="트리거 의무" value={`${obligations.length}개`} />
          <Stat label="분석 파일" value={`${result.stats.totalFiles}개`} />
          <Stat label="신호 (findings)" value={`${result.stats.totalFindings}개`} />
        </div>

        {result.refinement && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <div className="text-xs uppercase tracking-wider text-indigo-300 mb-2">
              Gemini 종합 의견
            </div>
            <p className="text-sm text-zinc-200 leading-relaxed mb-2">
              {result.refinement.overallSummary}
            </p>
            <div className="text-xs text-zinc-400">
              <span className="text-zinc-500">최우선:</span>{" "}
              {result.refinement.topPriority}
            </div>
          </div>
        )}

        {!result.refinement && result.refineError && (
          <div className="mt-4 pt-4 border-t border-zinc-800 text-xs text-zinc-500">
            Gemini 서술 보강 실패 — 결정적 분석 결과만 표시.
          </div>
        )}

        {!result.refinement && !result.refineError && (
          <div className="mt-4 pt-4 border-t border-zinc-800 text-xs text-zinc-500">
            <code>GEMINI_API_KEY</code> 미설정 — 결정적 분석 결과만 표시.
          </div>
        )}
      </div>

      {result.systems.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-500">
          검출된 AI 시스템이 없습니다.
        </div>
      )}

      {sortedSystems.map((s) => (
        <SystemCard key={s.id} system={s} refined={refineMap.get(s.id)} />
      ))}

      {result.unattributedFindings.length > 0 && (
        <details className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <summary className="cursor-pointer text-sm text-zinc-300">
            라이브러리 비매칭 코드 패턴 {result.unattributedFindings.length}개
          </summary>
          <ul className="mt-3 text-xs font-mono space-y-1 text-zinc-400">
            {result.unattributedFindings.map((f, i) => (
              <li key={i}>
                [{f.ruleId}] {f.filePath}:{f.lineStart}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500 mb-0.5">{label}</div>
      <div className="text-lg font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

function SystemCard({
  system: s,
  refined,
}: {
  system: AISystem;
  refined?: RefinedSystem;
}) {
  const priorityBadge = refined
    ? PRIORITY_BADGE[Math.min(5, Math.max(1, refined.priorityScore)) as 1 | 2 | 3 | 4 | 5]
    : null;

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-xs text-zinc-500">{s.catalogEntryId}</div>
          <div className="font-semibold text-lg break-words">{s.name}</div>
          {refined ? (
            <p className="text-sm text-zinc-200 leading-relaxed mt-1">
              {refined.humanSummary}
            </p>
          ) : (
            <div className="text-sm text-zinc-400 mt-1">{s.purpose}</div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0 items-end">
          <span className={`text-[10px] px-2 py-0.5 rounded ${RISK_BADGE[s.derivedRiskTier]}`}>
            위험: {s.derivedRiskTier.toUpperCase()}
          </span>
          {priorityBadge && (
            <span className={`text-[10px] px-2 py-0.5 rounded ${priorityBadge.cls}`}>
              {priorityBadge.label}
            </span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded ${CONF_BADGE[s.confidence]}`}>
            신뢰: {s.confidence}
          </span>
        </div>
      </header>

      {refined && (
        <details className="mt-3 group" open>
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-amber-300 hover:text-amber-200 select-none">
            왜 이 등급인가?
          </summary>
          <p className="text-sm text-zinc-300 leading-relaxed mt-2 pl-3 border-l-2 border-amber-500/30">
            {refined.riskNarrative}
          </p>
        </details>
      )}

      {refined && refined.mitigations.length > 0 && (
        <details className="mt-3" open>
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-emerald-300 hover:text-emerald-200 select-none">
            지금 해야 할 일 ({refined.mitigations.length}개)
          </summary>
          <ul className="mt-2 space-y-1 pl-3 border-l-2 border-emerald-500/30">
            {refined.mitigations.map((m, i) => (
              <li key={i} className="text-sm text-zinc-200 flex gap-2">
                <input type="checkbox" className="mt-1" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {refined && refined.gaps.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-sky-300 hover:text-sky-200 select-none">
            정보 부족 / 추가 확인 필요 ({refined.gaps.length}개)
          </summary>
          <ul className="mt-2 space-y-1 pl-3 border-l-2 border-sky-500/30 text-sm text-zinc-300">
            {refined.gaps.map((g, i) => (
              <li key={i}>· {g}</li>
            ))}
          </ul>
        </details>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs uppercase tracking-wider text-indigo-300 hover:text-indigo-200 select-none">
          트리거된 의무 ({s.triggeredObligations.length}개)
        </summary>
        <div className="flex flex-wrap gap-1 mt-2 pl-3 border-l-2 border-indigo-500/30">
          {s.triggeredObligations.map((o) => (
            <span
              key={o}
              className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-200"
            >
              {o}
            </span>
          ))}
        </div>
      </details>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs uppercase tracking-wider text-zinc-400 hover:text-zinc-200 select-none">
          기술 메타데이터
        </summary>
        <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 mt-2 pl-3 border-l-2 border-zinc-700">
          <Pair k="조달" v={s.procurement} />
          <Pair k="공급사" v={s.modelProvider} />
          {s.modelName && <Pair k="모델" v={s.modelName} />}
          <Pair k="해외모델" v={s.isForeignModel ? "예" : "아니오"} />
          <Pair k="도메인" v={s.domains.join(", ") || "general"} />
          <Pair k="모달리티" v={s.modalities.join(", ") || "-"} />
          <Pair k="생성형" v={s.isGenerative ? "예" : "아니오"} />
          <Pair k="자체학습" v={s.trainsOrFineTunes ? "예" : "아니오"} />
        </div>
      </details>

      {s.evidence.filePaths.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs uppercase tracking-wider text-zinc-400 hover:text-zinc-200 select-none">
            근거 파일 {s.evidence.filePaths.length}개
          </summary>
          <ul className="mt-2 pl-3 border-l-2 border-zinc-700 space-y-0.5 font-mono text-xs text-zinc-400">
            {s.evidence.filePaths.slice(0, 30).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-zinc-500">{k}:</span> {v}
    </div>
  );
}
