"use client";

/**
 * Layer C — Profile vs Code 모순 알림 배너.
 *
 * 사용자가 폼에서 입력한 사실과 코드에서 감지된 신호가 충돌할 때 노출.
 * 주의: 이건 "법 위반"이 아니라 "재확인이 필요하다"는 시그널.
 */
import type { ContradictionFlag, ContradictionKind } from "@/lib/scan/profile/merge";

interface Props {
  items: ContradictionFlag[];
}

const KIND_LABEL: Record<ContradictionKind, string> = {
  FOREIGN_MODEL_DENIED: "국외이전 부인 vs 외국 모델 감지",
  HIGH_IMPACT_DENIED: "고영향 부인 vs 고영향 키워드 감지",
  GENERATIVE_DENIED: "정보제공 한정 vs 생성형 SDK 감지",
  PERSONAL_DATA_DENIED: "개인정보 부인 vs 개인정보 처리 신호",
};

export function ContradictionBanner({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <span className="text-amber-600 text-lg leading-none mt-0.5">⚠</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-900">
            Profile과 코드 신호가 충돌합니다 ({items.length})
          </h3>
          <p className="text-xs text-amber-800 mt-0.5">
            아래 항목은 입력하신 사실과 코드 스캔 결과가 어긋납니다. 둘 중 어느
            쪽이 정확한지 확인하세요.
          </p>
          <ul className="mt-2.5 space-y-2">
            {items.map((c, i) => (
              <li
                key={i}
                className="rounded border border-amber-200 bg-white px-3 py-2"
              >
                <div className="text-xs font-semibold text-amber-900">
                  {KIND_LABEL[c.kind] ?? c.kind}
                </div>
                <div className="text-xs text-slate-700 mt-1 leading-relaxed">
                  {c.message}
                </div>
                {c.evidenceSystemIds.length > 0 ? (
                  <div className="text-[11px] text-slate-500 mt-1">
                    증거 시스템 ID:{" "}
                    <code className="font-mono">
                      {c.evidenceSystemIds.join(", ")}
                    </code>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
