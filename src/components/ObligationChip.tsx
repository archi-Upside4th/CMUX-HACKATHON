"use client";

import { useState } from "react";
import {
  obligationArticle,
  obligationExcerpts,
  obligationLabel,
  obligationPenalty,
} from "@/lib/laws/labels";
import { Icon } from "./Icon";

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
        className={`inline-flex items-center gap-1 rounded-full bg-slate-900 text-white hover:bg-black transition ${
          compact ? "px-2.5 py-0.5 text-[10px]" : "px-3 py-1 text-[12px]"
        }`}
        title={article}
      >
        <span>{label}</span>
        <Icon name={open ? "chevron-down" : "chevron-right"} size={10} />
      </button>
      {open && (
        <div className="mt-1.5 w-full max-w-md rounded-2xl bg-white p-3 text-[12px] text-slate-800 space-y-2 shadow-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
              조항
            </div>
            <div className="font-medium text-slate-900">{article}</div>
          </div>
          {reason && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">
                사유
              </div>
              <div className="leading-relaxed">{reason}</div>
            </div>
          )}
          {excerpts.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                발췌
              </div>
              <ul className="space-y-1.5">
                {excerpts.map((e) => (
                  <li
                    key={e.locator}
                    className="rounded-xl bg-[var(--surface-2)] p-2 text-[11px] leading-snug"
                  >
                    <div className="font-mono text-[10px] text-slate-400 mb-0.5">
                      {e.locator}
                    </div>
                    {e.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {penalty && (
            <div className="text-[11px] text-amber-700 pt-1">
              {penalty}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
