"use client";

import { useEffect, useState } from "react";
import type { AIUsage, DiagnosisResult, CompanyProfile } from "@/lib/types";
import { saveEntry } from "@/lib/storage/history";
import { CitationsBlock, VerifiedBadge } from "@/components/CitationsBlock";
import { obligationSourceUrl } from "@/lib/laws/labels";

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

  // 진단 결과 자동 저장
  useEffect(() => {
    if (!result) return;
    saveEntry({
      type: "diagnose",
      title: profile.name || "(이름 없음)",
      overallRisk: result.overallRisk,
      obligationCount: result.items.filter(
        (i) => i.applicability !== "not_applicable"
      ).length,
      payload: { profile, result },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

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
        <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-600 mb-2">
          AI 기본법 30초 진단
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          회사 AI 진단
        </h1>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form
          onSubmit={onSubmit}
          className="card-hover rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">회사 프로필</h2>
            <button
              type="button"
              onClick={loadDemoProfile}
              className="text-xs text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
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
                        ? "border-indigo-500 bg-indigo-100 text-indigo-700"
                        : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40"
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
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 px-4 py-3 font-medium transition"
          >
            {loading ? "진단 중…" : "AI기본법 30초 진단 실행"}
          </button>
        </form>

        <div className="space-y-4">
          {!result && !error && !loading && (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
              왼쪽 폼을 채운 뒤 진단을 실행하면<br />
              결과가 여기에 표시됩니다.
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 text-indigo-700 animate-pulse">
              Gemini가 회사 프로필과 AI기본법 조항을 매칭 중…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
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

function VerificationStats({ items }: { items: DiagnosisResult["items"] }) {
  const applicable = items.filter((i) => i.applicability !== "not_applicable");
  const verified = applicable.filter((i) => i.verified).length;
  const total = applicable.length;
  const allOk = total > 0 && verified === total;
  return (
    <div
      className={`text-xs rounded border px-3 py-2 ${
        allOk
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      <span className="font-mono mr-2">
        {verified}/{total}
      </span>
      {allOk
        ? "적용/조건부 항목 모두 조문 인용 검증됨 (RAG corpus 매칭)"
        : "일부 항목이 조문 인용 검증을 통과하지 못함 — 미검증 항목은 법무 재확인 필수"}
    </div>
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
      <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md bg-white border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function ResultPanel({ result }: { result: DiagnosisResult }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50/60 via-white to-fuchsia-50/40 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">진단 결과</h2>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${RISK_BADGE[result.overallRisk]}`}
          >
            전체 위험: {result.overallRisk.toUpperCase()}
          </span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed mb-3">{result.summary}</p>
        <VerificationStats items={result.items} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
          최우선 조치 (Top 3)
        </h3>
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
              <div className="min-w-0">
                <div className="text-xs text-slate-400">{item.legalBasis}</div>
                <div className="font-semibold">{item.title}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {item.obligationId}
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                <VerifiedBadge verified={item.verified} />
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
            <p className="text-sm text-slate-700 leading-relaxed mb-3">
              {item.reasoning}
            </p>

            <details className="mb-3" open={item.applicability !== "not_applicable"}>
              <summary className="cursor-pointer text-xs text-indigo-600 hover:text-indigo-700 mb-1">
                근거 조문 인용 ({item.citations.length})
              </summary>
              <div className="mt-2">
                <CitationsBlock citations={item.citations} obligationId={item.obligationId} />
                {obligationSourceUrl(item.obligationId) && (
                  <a
                    href={obligationSourceUrl(item.obligationId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-2 text-[10px] text-slate-400 hover:text-indigo-600 underline underline-offset-2"
                  >
                    원문: 국가법령정보센터 →
                  </a>
                )}
              </div>
            </details>

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
