/**
 * Analyzer entrypoint — manifest + source 스캔 통합.
 * Collector 결과 → ScanReport 생성.
 */
import type { CollectionResult } from "../collector/collector";
import type { ScanReport } from "../inputs/finding";
import { findingsFromManifests } from "./manifest";
import { findingsFromSource } from "./source";

export async function analyzeRepo(
  collected: Extract<CollectionResult, { ok: true }>
): Promise<ScanReport> {
  const manifestFindings = await findingsFromManifests(collected.files);
  const sourceFindings = await findingsFromSource(collected.files);

  const langStats: Record<string, number> = {};
  for (const f of collected.files) {
    if (f.ecosystem === "other") continue;
    langStats[f.ecosystem] = (langStats[f.ecosystem] ?? 0) + 1;
  }

  return {
    repoUrl: collected.normalizedUrl,
    commitSha: collected.commitSha,
    scannedAt: new Date().toISOString(),
    ecosystem: collected.ecosystems,
    findings: [...manifestFindings, ...sourceFindings],
    fileTree: {
      totalFiles: collected.files.length,
      languageStats: langStats,
    },
  };
}
