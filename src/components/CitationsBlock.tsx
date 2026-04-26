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
      <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200">
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
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-red-500/40 bg-red-500/10"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  verified
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-red-500/20 text-red-200"
                }`}
              >
                {verified ? `✓ ${c.verifiedLocator}` : "✗ 검증실패"}
              </span>
              {!verified && (
                <span className="text-[10px] text-red-300">
                  corpus 미일치 — 환각 가능성. 표시만 하고 신뢰하지 마세요.
                </span>
              )}
            </div>
            <div
              className={`border-l-2 pl-2 ${
                verified ? "border-emerald-400/60" : "border-red-400/60"
              } text-zinc-200`}
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
          ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
          : "bg-red-500/20 text-red-200 border border-red-500/40"
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
