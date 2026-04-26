import { Icon } from "./Icon";

interface Citation {
  text: string;
  verifiedLocator: string | null;
}

interface Props {
  citations: Citation[];
  obligationId?: string;
}

export function CitationsBlock({ citations }: Props) {
  if (citations.length === 0) {
    return (
      <div className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
        인용 없음 — 법무 검토 필요
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {citations.map((c, i) => {
        const verified = c.verifiedLocator !== null;
        return (
          <div
            key={i}
            className={`rounded-xl px-3 py-2.5 text-[12px] leading-snug ${
              verified ? "bg-emerald-50" : "bg-rose-50"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon
                name={verified ? "check" : "x"}
                size={12}
                className={verified ? "text-emerald-600" : "text-rose-600"}
              />
              <span
                className={`font-mono text-[10px] ${
                  verified ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {verified ? c.verifiedLocator : "검증 실패"}
              </span>
            </div>
            <div className="text-slate-800">&ldquo;{c.text}&rdquo;</div>
          </div>
        );
      })}
    </div>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
        verified
          ? "bg-emerald-100 text-emerald-700"
          : "bg-rose-100 text-rose-700"
      }`}
      title={verified ? "조문 검증됨" : "검증 실패"}
    >
      <Icon name={verified ? "check" : "x"} size={10} />
      {verified ? "검증" : "미검증"}
    </span>
  );
}
