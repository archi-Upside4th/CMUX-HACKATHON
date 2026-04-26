"use client";

import { useState } from "react";
import type { AIUsage, DiagnosisResult, CompanyProfile } from "@/lib/types";

const AI_OPTIONS: { value: AIUsage; label: string }[] = [
  { value: "chatbot", label: "챗봇/대화형" },
  { value: "recommendation", label: "추천 엔진" },
  { value: "generative_text", label: "텍스트 생성형" },
  { value: "generative_image", label: "이미지/영상 생성형" },
  { value: "auto_decision", label: "자동심사/자동결정 (채용·대출 등)" },
  { value: "biometric", label: "생체인식" },
  { value: "medical", label: "의료 진단/판독" },
  { value: "none", label: "사용 안 함" },
];

const RISK_BADGE: Record<string, string> = {
  high: "bg-red-500/20 text-red-300 border border-red-500/40",
  medium: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  low: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  none: "bg-zinc-700/40 text-zinc-300 border border-zinc-600",
};

const APP_BADGE: Record<string, string> = {
  applicable: "bg-red-500/15 text-red-300",
  conditional: "bg-amber-500/15 text-amber-300",
  not_applicable: "bg-zinc-700/40 text-zinc-400",
};

export default function Home() {
  const [profile, setProfile] = useState<CompanyProfile>({
    name: "",
    industry: "",
    employeeCount: 50,
    annualRevenueKRW: 5_000_000_000,
    aiUsages: [],
    usesForeignAI: false,
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);

  function toggleUsage(value: AIUsage) {
    setProfile((p) => {
      const has = p.aiUsages.includes(value);
      return {
        ...p,
        aiUsages: has
          ? p.aiUsages.filter((v) => v !== value)
          : [...p.aiUsages, value],
      };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "진단 실패");
      } else {
        setResult(data.result as DiagnosisResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function loadDemoProfile() {
    setProfile({
      name: "데모핀테크",
      industry: "핀테크 (대출 심사)",
      employeeCount: 120,
      annualRevenueKRW: 30_000_000_000,
      aiUsages: ["auto_decision", "chatbot", "generative_text"],
      usesForeignAI: true,
      notes: "OpenAI GPT-4o 기반 챗봇과 자체 ML 신용평가 모델 운영 중. 워터마크 미적용.",
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 grid place-items-center font-bold">
            L
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">LexOS</h1>
            <p className="text-sm text-zinc-400">
              AI 규제 자동 대응 플랫폼 · AI기본법 30초 진단
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">회사 프로필</h2>
            <button
              type="button"
              onClick={loadDemoProfile}
              className="text-xs text-indigo-300 hover:text-indigo-200 underline underline-offset-2"
            >
              데모 프로필 자동입력
            </button>
          </div>

          <Field label="회사명">
            <input
              required
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className={inputCls}
              placeholder="예: 데모핀테크"
            />
          </Field>

          <Field label="업종">
            <input
              required
              value={profile.industry}
              onChange={(e) =>
                setProfile({ ...profile, industry: e.target.value })
              }
              className={inputCls}
              placeholder="예: 핀테크, 이커머스, SaaS"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="임직원 수">
              <input
                type="number"
                min={1}
                required
                value={profile.employeeCount}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    employeeCount: Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </Field>
            <Field label="연매출 (원)">
              <input
                type="number"
                min={0}
                required
                value={profile.annualRevenueKRW}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    annualRevenueKRW: Number(e.target.value),
                  })
                }
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="사용 중인 AI (복수 선택)">
            <div className="grid grid-cols-2 gap-2">
              {AI_OPTIONS.map((opt) => {
                const checked = profile.aiUsages.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => toggleUsage(opt.value)}
                    className={`text-left text-sm rounded-md px-3 py-2 border transition ${
                      checked
                        ? "border-indigo-400 bg-indigo-500/15 text-indigo-100"
                        : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.usesForeignAI}
              onChange={(e) =>
                setProfile({ ...profile, usesForeignAI: e.target.checked })
              }
              className="h-4 w-4"
            />
            <span>해외 AI 모델/서비스 직접 호출 (OpenAI, Anthropic 등)</span>
          </label>

          <Field label="추가 메모 (선택)">
            <textarea
              value={profile.notes}
              onChange={(e) =>
                setProfile({ ...profile, notes: e.target.value })
              }
              className={`${inputCls} min-h-[72px]`}
              placeholder="현재 운영 중인 AI 시스템, 알려진 미준수 사항 등"
            />
          </Field>

          <button
            type="submit"
            disabled={loading || profile.aiUsages.length === 0}
            className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:bg-zinc-700 disabled:text-zinc-400 px-4 py-3 font-medium transition"
          >
            {loading ? "진단 중…" : "AI기본법 30초 진단 실행"}
          </button>
        </form>

        <div className="space-y-4">
          {!result && !error && !loading && (
            <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-zinc-500">
              왼쪽 폼을 채운 뒤 진단을 실행하면<br />
              결과가 여기에 표시됩니다.
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-6 text-indigo-200 animate-pulse">
              Gemini가 회사 프로필과 AI기본법 조항을 매칭 중…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-200">
              <strong className="block mb-1">오류</strong>
              <pre className="text-xs whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          {result && <ResultPanel result={result} />}
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

function ResultPanel({ result }: { result: DiagnosisResult }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">진단 결과</h2>
          <span
            className={`text-xs px-2 py-1 rounded-md ${RISK_BADGE[result.overallRisk]}`}
          >
            전체 위험: {result.overallRisk.toUpperCase()}
          </span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">{result.summary}</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h3 className="font-semibold mb-3">최우선 조치 (Top 3)</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-200">
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
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
          >
            <header className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="text-xs text-zinc-500">{item.legalBasis}</div>
                <div className="font-semibold">{item.title}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${APP_BADGE[item.applicability]}`}
                >
                  {item.applicability}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded ${RISK_BADGE[item.riskLevel]}`}
                >
                  {item.riskLevel}
                </span>
              </div>
            </header>
            <p className="text-sm text-zinc-300 leading-relaxed mb-3">
              {item.reasoning}
            </p>
            {item.actionItems.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-zinc-400 mb-1">이행 체크리스트</div>
                <ul className="space-y-1">
                  {item.actionItems.map((a, i) => (
                    <li key={i} className="text-sm text-zinc-200 flex gap-2">
                      <input type="checkbox" className="mt-1" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-zinc-400 mt-3 pt-3 border-t border-zinc-800">
              <div>
                <span className="text-zinc-500">마감:</span> {item.deadline}
              </div>
              {item.evidenceTypes.length > 0 && (
                <div>
                  <span className="text-zinc-500">증거:</span>{" "}
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
