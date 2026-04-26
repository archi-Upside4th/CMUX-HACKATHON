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
      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-700">
        ⚠ 인용된 조문이 없습니다 — AI 응답 신뢰도 낮음. 법무 검토 권장.
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
            className={`rounded border p-2 text-[11px] leading-snug ${
              verified
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  verified
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {verified ? `✓ ${c.verifiedLocator}` : "✗ 검증실패"}
              </span>
              {!verified && (
                <span className="text-[10px] text-rose-700">
                  corpus 미일치 — 환각 가능성. 표시만 하고 신뢰하지 마세요.
                </span>
              )}
            </div>
            <div
              className={`border-l-2 pl-2 ${
                verified ? "border-emerald-400" : "border-rose-400"
              } text-slate-800`}
            >
              "{c.text}"
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded ${
        verified
          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
          : "bg-rose-100 text-rose-700 border border-rose-200"
      }`}
      title={
        verified
          ? "인용된 조문이 RAG corpus와 일치 — 검증됨"
          : "인용 검증 실패 — 법무 재검토 필요"
      }
    >
      {verified ? "✓ 조문 검증됨" : "✗ 미검증"}
    </span>
  );
}
