"use client";

import { useState } from "react";

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

export default function ScanPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);

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
        setError(data.error + (data.reason ? `: ${data.reason}` : "") + (data.detail ? `\n${data.detail}` : ""));
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
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center font-bold">
            L
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">LexOS Scan</h1>
            <p className="text-sm text-zinc-400">
              GitHub 저장소 코드 분석 → AI기본법 의무 자동 매핑
            </p>
          </div>
        </div>
        <nav className="mt-4 text-sm">
          <a href="/" className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2">
            ← 회사 프로필 진단으로
          </a>
        </nav>
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
          {loading ? "스캔 중… (수집 → 분석 → 합성)" : "코드 스캔 실행"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-200 mb-6">
          <strong className="block mb-1">오류</strong>
          <pre className="text-xs whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {result && (
        <section className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold mb-2">스캔 요약</h2>
            <div className="text-sm text-zinc-300 space-y-1">
              <div>
                <span className="text-zinc-500">저장소:</span>{" "}
                <code className="text-xs">{result.repoUrl}</code>
              </div>
              <div>
                <span className="text-zinc-500">커밋:</span>{" "}
                <code className="text-xs">{result.commitSha.slice(0, 12)}</code>
              </div>
              <div>
                <span className="text-zinc-500">파일:</span>{" "}
                {result.stats.totalFiles}개{" "}
                <span className="text-zinc-500">
                  ({Object.entries(result.stats.languageStats).map(([k, v]) => `${k}:${v}`).join(", ") || "없음"})
                </span>
              </div>
              <div>
                <span className="text-zinc-500">신호 (findings):</span>{" "}
                {result.stats.totalFindings}개
              </div>
              <div>
                <span className="text-zinc-500">검출된 AI 시스템:</span>{" "}
                <strong>{result.systems.length}</strong>
              </div>
            </div>
          </div>

          {result.systems.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-500">
              검출된 AI 시스템이 없습니다.
            </div>
          )}

          {result.systems.map((s) => (
            <article
              key={s.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <header className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-xs text-zinc-500">{s.catalogEntryId}</div>
                  <div className="font-semibold text-lg">{s.name}</div>
                  <div className="text-sm text-zinc-400">{s.purpose}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded ${RISK_BADGE[s.derivedRiskTier]}`}>
                    위험: {s.derivedRiskTier.toUpperCase()}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${CONF_BADGE[s.confidence]}`}>
                    신뢰: {s.confidence}
                  </span>
                </div>
              </header>

              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 mt-3 mb-3">
                <Pair k="조달" v={s.procurement} />
                <Pair k="공급사" v={s.modelProvider} />
                {s.modelName && <Pair k="모델" v={s.modelName} />}
                <Pair k="해외모델" v={s.isForeignModel ? "예" : "아니오"} />
                <Pair k="도메인" v={s.domains.join(", ") || "general"} />
                <Pair k="모달리티" v={s.modalities.join(", ") || "-"} />
                <Pair k="생성형" v={s.isGenerative ? "예" : "아니오"} />
                <Pair k="자체학습" v={s.trainsOrFineTunes ? "예" : "아니오"} />
              </div>

              <div className="mb-3">
                <div className="text-xs text-zinc-400 mb-1">트리거 의무 ({s.triggeredObligations.length}개)</div>
                <div className="flex flex-wrap gap-1">
                  {s.triggeredObligations.map((o) => (
                    <span
                      key={o}
                      className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-200"
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>

              {s.evidence.filePaths.length > 0 && (
                <details className="text-xs text-zinc-400">
                  <summary className="cursor-pointer hover:text-zinc-200">
                    근거 파일 {s.evidence.filePaths.length}개
                  </summary>
                  <ul className="mt-2 space-y-0.5 font-mono">
                    {s.evidence.filePaths.slice(0, 30).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
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
      )}
    </main>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-zinc-500">{k}:</span> {v}
    </div>
  );
}
