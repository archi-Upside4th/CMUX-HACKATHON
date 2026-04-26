"use client";

/**
 * Layer C 머지 결과를 의무 4-status 매트릭스로 시각화.
 *
 * 출처 칩 (Profile/Code) — 어느 레이어가 트리거했는지 한눈에.
 */
import {
  obligationLabel,
  obligationArticle,
  obligationPenalty,
  obligationSourceUrl,
} from "@/lib/laws/labels";
import type { MergedObligation, MergedObligationStatus } from "@/lib/scan/profile/merge";

interface Props {
  items: MergedObligation[];
}

const STATUS_LABEL: Record<MergedObligationStatus, string> = {
  REQUIRED: "필수",
  SUSPECTED: "의심",
  CONDITIONAL: "조건부",
  NOT_APPLICABLE: "비적용",
};

const STATUS_BADGE: Record<MergedObligationStatus, string> = {
  REQUIRED: "bg-red-50 text-red-700 border-red-200",
  SUSPECTED: "bg-amber-50 text-amber-800 border-amber-200",
  CONDITIONAL: "bg-blue-50 text-blue-700 border-blue-200",
  NOT_APPLICABLE: "bg-slate-50 text-slate-500 border-slate-200",
};

const STATUS_DOT: Record<MergedObligationStatus, string> = {
  REQUIRED: "bg-red-500",
  SUSPECTED: "bg-amber-500",
  CONDITIONAL: "bg-blue-500",
  NOT_APPLICABLE: "bg-slate-300",
};

export function MergedObligationMatrix({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
        의무가 도출되지 않았습니다.
      </div>
    );
  }

  // 상태별 카운트 (NOT_APPLICABLE은 별도 노출)
  const counts = items.reduce<Record<MergedObligationStatus, number>>(
    (acc, m) => {
      acc[m.status] = (acc[m.status] ?? 0) + 1;
      return acc;
    },
    { REQUIRED: 0, SUSPECTED: 0, CONDITIONAL: 0, NOT_APPLICABLE: 0 }
  );

  const visible = items.filter((m) => m.status !== "NOT_APPLICABLE");
  const hidden = items.filter((m) => m.status === "NOT_APPLICABLE");

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-base font-semibold text-slate-900">
          의무 매트릭스
        </h2>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {(["REQUIRED", "SUSPECTED", "CONDITIONAL"] as const).map((s) =>
            counts[s] > 0 ? (
              <span
                key={s}
                className={`px-2 py-0.5 rounded border ${STATUS_BADGE[s]}`}
              >
                {STATUS_LABEL[s]} {counts[s]}
              </span>
            ) : null
          )}
          {counts.NOT_APPLICABLE > 0 ? (
            <span className={`px-2 py-0.5 rounded border ${STATUS_BADGE.NOT_APPLICABLE}`}>
              비적용 {counts.NOT_APPLICABLE}
            </span>
          ) : null}
        </div>
      </header>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {visible.map((m) => (
            <ObligationRow key={m.obligationId} item={m} />
          ))}
        </ul>
      </div>

      {hidden.length > 0 ? (
        <details className="rounded-lg border border-slate-200 bg-slate-50">
          <summary className="px-4 py-2.5 text-xs text-slate-600 cursor-pointer select-none">
            비적용 의무 {hidden.length}개 보기 (참고)
          </summary>
          <ul className="divide-y divide-slate-200 border-t border-slate-200">
            {hidden.map((m) => (
              <ObligationRow key={m.obligationId} item={m} muted />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ObligationRow({
  item,
  muted,
}: {
  item: MergedObligation;
  muted?: boolean;
}) {
  const sourceUrl = obligationSourceUrl(item.obligationId);
  const penalty = obligationPenalty(item.obligationId);
  return (
    <li className={`px-4 py-3.5 ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[item.status]}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_BADGE[item.status]}`}
            >
              {STATUS_LABEL[item.status]}
            </span>
            <h3 className="text-sm font-semibold text-slate-900">
              {obligationLabel(item.obligationId)}
            </h3>
            <span className="text-xs text-slate-400">
              {obligationArticle(item.obligationId)}
            </span>
          </div>

          {/* 트리거 출처 */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {item.triggeredBy.profile ? (
              <SourceChip variant="profile" label="Profile" />
            ) : null}
            {item.triggeredBy.code ? (
              <SourceChip
                variant="code"
                label={`Code · ${item.codeEvidence.catalogIds.length}건`}
              />
            ) : null}
            {!item.triggeredBy.profile && !item.triggeredBy.code ? (
              <SourceChip variant="none" label="신호 없음" />
            ) : null}
          </div>

          {/* 사유 */}
          {item.profileReason ? (
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              <span className="font-medium text-slate-500">사유:</span>{" "}
              {item.profileReason}
            </p>
          ) : null}

          {item.contradiction ? (
            <p className="mt-1.5 text-xs text-amber-700 leading-relaxed">
              ⚠ {item.contradiction}
            </p>
          ) : null}

          {/* 코드 증거 */}
          {item.codeEvidence.catalogIds.length > 0 ? (
            <p className="mt-1.5 text-xs text-slate-500">
              증거 카탈로그:{" "}
              <code className="font-mono text-[11px] text-slate-700">
                {item.codeEvidence.catalogIds.join(", ")}
              </code>
            </p>
          ) : null}

          {/* 메타 */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            {penalty ? <span>벌칙: {penalty}</span> : null}
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                법령 원문 →
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function SourceChip({
  variant,
  label,
}: {
  variant: "profile" | "code" | "none";
  label: string;
}) {
  const cls =
    variant === "profile"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : variant === "code"
        ? "bg-violet-50 text-violet-700 border-violet-200"
        : "bg-slate-50 text-slate-500 border-slate-200";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}
