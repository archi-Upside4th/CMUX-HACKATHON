"use client";

/**
 * /scan — 3-Layer 컴플라이언스 스캔 wizard.
 *
 * Step 1: Profile (Layer A — 11문항)
 * Step 2: Source  (Layer B — GitHub URL or ZIP)
 *   ↓ multipart/JSON submit → /api/scan
 * Result: Layer C 머지 매트릭스 + (선택) Gemini 컴플라이언스 리포트
 *
 * Layer C 결과는 결정적(deterministic). Gemini 결과는 보조.
 */
import { useEffect, useMemo, useState } from "react";
import { ProfileIntakeForm } from "@/components/ProfileIntakeForm";
import { SourcePicker, type SourceSelection } from "@/components/SourcePicker";
import {
  CONSERVATIVE_DEFAULT_PROFILE,
  type ServiceProfileIntake,
} from "@/lib/scan/profile/schema";
import { saveEntry } from "@/lib/storage/history";
import { ScanResultView, type ScanResult } from "./ScanResultView";

type ScanResponse = ScanResult & {
  ok: true;
  sourceKind: "git" | "zip";
};

type Step = "profile" | "source" | "running" | "result";

export default function ScanPage() {
  const [step, setStep] = useState<Step>("profile");
  const [profile, setProfile] = useState<ServiceProfileIntake>(
    CONSERVATIVE_DEFAULT_PROFILE
  );
  const [source, setSource] = useState<SourceSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Result 저장
  useEffect(() => {
    if (!result) return;
    const merged = result.mergedObligations ?? [];
    const required = merged.filter((m) => m.status === "REQUIRED").length;
    const saved = saveEntry({
      type: "scan",
      title: result.repoUrl,
      overallRisk:
        result.report?.overallRisk ?? overallRiskOf(result.systems),
      systemCount: result.systems.length,
      obligationCount: required,
      payload: result,
    });
    setSavedId(saved.id);
  }, [result]);

  async function runScan() {
    if (!source) return;
    setStep("running");
    setError(null);
    setResult(null);
    setSavedId(null);

    try {
      const profileJson = JSON.stringify(profile);
      let res: Response;
      if (source.kind === "zip") {
        const fd = new FormData();
        fd.append("zip", source.file);
        fd.append("profile", profileJson);
        res = await fetch("/api/scan", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoUrl: source.url, profile }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data));
        setStep("source");
        return;
      }
      setResult(data as ScanResponse);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("source");
    }
  }

  function reset() {
    setStep("profile");
    setSource(null);
    setError(null);
    setResult(null);
    setSavedId(null);
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">
          AI 기본법 컴플라이언스 스캔
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          3-Layer 자동 진단
        </h1>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
          ① 서비스 프로필 입력 → ② 코드 스캔 → ③ 의무 매트릭스 자동 산출.
          코드만으로는 판단 불가능한 비즈니스 변수(B2C/B2B, 국외이전, 고영향
          여부)를 폼으로 보강합니다.
        </p>
      </header>

      <Stepper step={step} />

      {step === "profile" && (
        <div className="space-y-5">
          <ProfileIntakeForm value={profile} onChange={setProfile} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep("source")}
              className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
            >
              다음 — 코드 소스 선택
            </button>
          </div>
        </div>
      )}

      {step === "source" && (
        <div className="space-y-5">
          <ProfileSummary profile={profile} onEdit={() => setStep("profile")} />
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">
              코드 소스
            </h2>
            <SourcePicker value={source} onChange={setSource} />
          </section>
          {error && <ErrorBox message={error} />}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep("profile")}
              className="px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100 transition"
            >
              ← 이전
            </button>
            <button
              type="button"
              onClick={runScan}
              disabled={!source}
              className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
            >
              스캔 실행
            </button>
          </div>
        </div>
      )}

      {step === "running" && <RunningView source={source} />}

      {step === "result" && result && (
        <ScanResultView result={result} savedId={savedId} onReset={reset} />
      )}
    </main>
  );
}

// ──────────────────────────────────────────────────────────
// Stepper
// ──────────────────────────────────────────────────────────

function Stepper({ step }: { step: Step }) {
  const steps: Array<{ key: Step | "result"; label: string }> = [
    { key: "profile", label: "1 · 프로필" },
    { key: "source", label: "2 · 소스" },
    { key: "result", label: "3 · 결과" },
  ];

  // 현재 단계 인덱스
  const idx = useMemo(() => {
    if (step === "profile") return 0;
    if (step === "source") return 1;
    return 2;
  }, [step]);

  return (
    <nav className="mb-6 flex items-center gap-3 text-xs">
      {steps.map((s, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 ${
                active
                  ? "text-slate-900 font-semibold"
                  : done
                    ? "text-slate-500"
                    : "text-slate-400"
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full grid place-items-center text-[10px] ${
                  active
                    ? "bg-slate-900 text-white"
                    : done
                      ? "bg-slate-200 text-slate-700"
                      : "border border-slate-300 text-slate-400"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <span className="h-px w-8 bg-slate-200" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ──────────────────────────────────────────────────────────
// Profile summary (when on source step)
// ──────────────────────────────────────────────────────────

function ProfileSummary({
  profile,
  onEdit,
}: {
  profile: ServiceProfileIntake;
  onEdit: () => void;
}) {
  const items: Array<[string, string]> = [
    ["서비스", profile.serviceType],
    ["거주지", profile.userResidency],
    ["리전", profile.deploymentRegion],
    ["개인정보", profile.personalData.processes ? "처리" : "없음"],
    [
      "국외이전",
      profile.crossBorderTransfer === null
        ? "모름"
        : profile.crossBorderTransfer
          ? "있음"
          : "없음",
    ],
    ["자동화", profile.automationLevel],
    [
      "고영향",
      profile.highImpactDomains.length === 0
        ? "—"
        : profile.highImpactDomains.join(", "),
    ],
  ];
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          입력한 프로필
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-blue-600 hover:underline"
        >
          수정
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
        {items.map(([k, v]) => (
          <span key={k}>
            <span className="text-slate-400">{k}:</span>{" "}
            <span className="font-medium">{v}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// Running placeholder
// ──────────────────────────────────────────────────────────

function RunningView({ source }: { source: SourceSelection | null }) {
  const label =
    source?.kind === "zip"
      ? `📦 ${source.file.name} 분석 중`
      : source?.kind === "url"
        ? `🔗 ${source.url} 클론 중`
        : "분석 준비 중";
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-8 text-center">
      <div className="inline-block h-6 w-6 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mb-3" />
      <div className="text-sm font-medium text-slate-900">{label}</div>
      <div className="text-xs text-slate-500 mt-1.5">
        수집 → 분석 → 합성 → 머지 → (선택) Gemini 리포트
      </div>
      <div className="text-[11px] text-slate-400 mt-3">
        대형 저장소는 최대 90초까지 소요될 수 있습니다.
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────
// Misc
// ──────────────────────────────────────────────────────────

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3">
      <strong className="block text-xs font-semibold text-red-900 mb-1">
        오류
      </strong>
      <pre className="text-xs text-red-800 whitespace-pre-wrap">{message}</pre>
    </div>
  );
}

function formatApiError(data: unknown): string {
  if (!data || typeof data !== "object") return "알 수 없는 오류";
  const d = data as Record<string, unknown>;
  return [
    d.error,
    d.reason ? `: ${d.reason}` : "",
    d.detail ? `\n${d.detail}` : "",
  ]
    .filter(Boolean)
    .join("");
}

function overallRiskOf(
  systems: ScanResult["systems"]
): "high" | "medium" | "low" | "none" {
  if (systems.length === 0) return "none";
  if (systems.some((s) => s.derivedRiskTier === "high")) return "high";
  if (systems.some((s) => s.derivedRiskTier === "medium")) return "medium";
  return "low";
}
