"use client";

import { useState } from "react";
import {
  obligationArticle,
  obligationExcerpts,
  obligationLabel,
  obligationPenalty,
} from "@/lib/laws/labels";

interface Props {
  obligationId: string;
  reason?: string;
  compact?: boolean;
}

export function ObligationChip({ obligationId, reason, compact }: Props) {
  const [open, setOpen] = useState(false);
  const label = obligationLabel(obligationId);
  const article = obligationArticle(obligationId);
  const penalty = obligationPenalty(obligationId);
  const excerpts = obligationExcerpts(obligationId);

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-left rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition ${
          compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
        }`}
        title={article}
      >
        <span className="font-medium">{label}</span>
        <span className="ml-1 font-mono text-indigo-500/80">[{obligationId}]</span>
        <span className="ml-1 text-indigo-500/70">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-1 w-full max-w-md rounded border border-indigo-200 bg-indigo-50 p-2 text-xs text-slate-800 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-indigo-600">
            근거 조항
          </div>
          <div className="font-medium text-indigo-700">{article}</div>
          {reason && (
            <>
              <div className="text-[10px] uppercase tracking-wider text-indigo-600 pt-1">
                트리거 사유
              </div>
              <div className="text-slate-800 leading-relaxed">{reason}</div>
            </>
          )}
          {excerpts.length > 0 && (
            <>
              <div className="text-[10px] uppercase tracking-wider text-indigo-600 pt-1">
                조문 발췌
              </div>
              <ul className="space-y-1">
                {excerpts.map((e) => (
                  <li
                    key={e.locator}
                    className="border-l-2 border-indigo-400 pl-2 text-[11px] text-slate-800 leading-snug"
                  >
                    <span className="text-indigo-600 font-mono mr-1">
                      {e.locator}
                    </span>
                    {e.text}
                  </li>
                ))}
              </ul>
            </>
          )}
          {penalty && (
            <div className="pt-1 text-[11px] text-amber-700">
              <span className="text-amber-600/80 font-mono mr-1">제재:</span>
              {penalty}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
