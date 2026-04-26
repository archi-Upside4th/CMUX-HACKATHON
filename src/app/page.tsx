"use client";

import { useEffect, useState } from "react";
import type { AIUsage, DiagnosisResult, CompanyProfile } from "@/lib/types";
import { saveEntry } from "@/lib/storage/history";
import { CitationsBlock, VerifiedBadge } from "@/components/CitationsBlock";
import { obligationSourceUrl } from "@/lib/laws/labels";
import { Icon } from "@/components/Icon";

const AI_OPTIONS: { value: AIUsage; label: string }[] = [
  { value: "chatbot", label: "챗봇" },
  { value: "recommendation", label: "추천" },
  { value: "generative_text", label: "텍스트 생성" },
  { value: "generative_image", label: "이미지 생성" },
  { value: "auto_decision", label: "자동결정" },
  { value: "biometric", label: "생체인식" },
  { value: "medical", label: "의료 판독" },
  { value: "none", label: "없음" },
];

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
      industry: "핀테크",
      employeeCount: 120,
      annualRevenueKRW: 30_000_000_000,
      aiUsages: ["auto_decision", "chatbot", "generative_text"],
      usesForeignAI: true,
      notes: "OpenAI 기반 챗봇 + 자체 신용평가 모델",
    });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 pt-6 pb-16">
      <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
        <h1 className="text-[44px] sm:text-[56px] font-semibold tracking-[-0.02em] leading-none text-slate-900">
          진단
        </h1>
        <button
          type="button"
          onClick={loadDemoProfile}
          className="text-[12px] text-slate-400 hover:text-slate-900 transition"
        >
          데모 입력
        </button>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form onSubmit={onSubmit} className="rounded-3xl bg-white p-7 space-y-5">
          <Field label="회사명">
            <input
              required
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className={inputCls}
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
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="임직원">
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
            <Field label="연매출">
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

          <Field label="AI 유형">
            <div className="flex flex-wrap gap-1.5">
              {AI_OPTIONS.map((opt) => {
                const checked = profile.aiUsages.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => toggleUsage(opt.value)}
                    className={`text-[13px] rounded-full px-3.5 py-1.5 transition ${
                      checked
                        ? "bg-slate-900 text-white"
                        : "bg-[var(--surface-2)] text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <label className="flex items-center justify-between gap-3 text-[13px] py-1">
            <span className="text-slate-700">해외 AI 직접 호출</span>
            <Toggle
              checked={profile.usesForeignAI}
              onChange={(v) => setProfile({ ...profile, usesForeignAI: v })}
            />
          </label>

          <Field label="메모">
            <textarea
              value={profile.notes}
              onChange={(e) =>
                setProfile({ ...profile, notes: e.target.value })
              }
              className={`${inputCls} min-h-[80px] resize-none`}
            />
          </Field>

          <button
            type="submit"
            disabled={loading || profile.aiUsages.length === 0}
            className="w-full rounded-full bg-slate-900 hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-3.5 text-[14px] font-medium transition"
          >
            {loading ? "진단 중…" : "진단 실행"}
          </button>
        </form>

        <div className="space-y-4">
          {!result && !error && !loading && (
            <div className="rounded-3xl bg-[var(--surface-2)] p-12 text-center text-sm text-slate-400">
              결과 영역
            </div>
          )}

          {loading && (
            <div className="rounded-3xl bg-white p-7 text-slate-500 animate-pulse">
              매칭 중…
            </div>
          )}

          {error && (
            <div className="rounded-3xl bg-rose-50 p-7 text-rose-700">
              <pre className="text-xs whitespace-pre-wrap">{error}</pre>
            </div>
          )}

          {result && <ResultPanel result={result} />}
        </div>
      </section>
    </main>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 rounded-full transition ${
        checked ? "bg-slate-900" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function VerificationStats({ items }: { items: DiagnosisResult["items"] }) {
  const applicable = items.filter((i) => i.applicability !== "not_applicable");
  const verified = applicable.filter((i) => i.verified).length;
  const total = applicable.length;
  const allOk = total > 0 && verified === total;
  return (
    <div
      className={`inline-flex items-center gap-2 text-[12px] rounded-full px-3 py-1.5 ${
        allOk
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700"
      }`}
    >
      <Icon name={allOk ? "shield-check" : "spark"} size={14} />
      <span className="font-mono tabular-nums">
        {verified}/{total}
      </span>
      <span>{allOk ? "검증 완료" : "일부 미검증"}</span>
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
      <span className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl bg-[var(--surface-2)] border-0 px-4 py-2.5 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition";

function ResultPanel({ result }: { result: DiagnosisResult }) {
  return (
    <div className="space-y-3">
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
        <p className="text-[14px] text-slate-800 leading-relaxed mb-4">
          {result.summary}
        </p>
        <VerificationStats items={result.items} />
      </div>

      <div className="rounded-3xl bg-white p-7">
        <h3 className="text-[11px] uppercase tracking-wider text-slate-400 mb-3">
          최우선 조치
        </h3>
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
        <h3 className="text-[11px] uppercase tracking-wider text-slate-400 px-1">
          조항별
        </h3>
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
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${APP_PILL[item.applicability]}`}>
                  {APP_LABEL[item.applicability]}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${RISK_PILL[item.riskLevel]}`}>
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
                    <Icon name="check" size={14} className="text-slate-400 mt-0.5 shrink-0" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-100">
              <span>{item.deadline}</span>
              {item.evidenceTypes.length > 0 && (
                <span className="truncate">{item.evidenceTypes.join(" · ")}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
