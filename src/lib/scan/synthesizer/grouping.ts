/**
 * 결정적 그룹화 — 그룹 키 = (catalogEntryId, modelName?, dirRoot)
 */
import path from "node:path";
import type { Finding } from "../inputs/finding";

export interface FindingGroup {
  key: string;
  catalogEntryId: string;
  modelName?: string;
  dirRoot: string;
  findings: Finding[];
}

export function groupFindings(findings: Finding[]): FindingGroup[] {
  const buckets = new Map<string, FindingGroup>();
  for (const f of findings) {
    if (!f.catalogEntryId) continue; // pure code_pattern은 그룹화 X (별도 처리)
    if (f.testOnly) continue; // 테스트 only는 그룹화 X
    const dirRoot = topLevelRoute(f.filePath);
    const modelName = f.extracted?.modelName;
    const key = [f.catalogEntryId, modelName ?? "*", dirRoot].join("|");
    const existing = buckets.get(key);
    if (existing) existing.findings.push(f);
    else
      buckets.set(key, {
        key,
        catalogEntryId: f.catalogEntryId,
        modelName,
        dirRoot,
        findings: [f],
      });
  }
  return [...buckets.values()];
}

export function topLevelRoute(filePath: string): string {
  const norm = filePath.replace(/\\/g, "/");
  // Next.js: app/api/<route>/route.ts
  const m1 = norm.match(/(?:^|\/)(?:app|pages)\/api\/([^\/]+)/);
  if (m1) return `route:${m1[1]}`;
  // 일반: src/services/<svc>/, src/<feature>/
  const m2 = norm.match(/(?:^|\/)(?:src|lib|services|apps)\/([^\/]+)/);
  if (m2) return `mod:${m2[1]}`;
  // top-level dir
  const segs = norm.split("/").filter(Boolean);
  if (segs.length >= 2) return `dir:${segs[0]}`;
  return "root";
}
