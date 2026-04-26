import {
  AI_BASIC_ACT_OBLIGATIONS,
  type LawObligation,
} from "@/lib/laws/ai-basic-act";

const BY_ID = new Map<string, LawObligation>(
  AI_BASIC_ACT_OBLIGATIONS.map((o) => [o.id, o])
);

export function obligationLabel(id: string): string {
  return BY_ID.get(id)?.title ?? id;
}

export function obligationArticle(id: string): string {
  return BY_ID.get(id)?.article ?? id;
}

export function obligationPenalty(id: string): string | undefined {
  return BY_ID.get(id)?.penalty;
}

export function obligationExcerpts(id: string): { locator: string; text: string }[] {
  return BY_ID.get(id)?.excerpts ?? [];
}

export function obligationSourceUrl(id: string): string | undefined {
  return BY_ID.get(id)?.sourceUrl;
}
