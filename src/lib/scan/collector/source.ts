/**
 * Source dispatcher — git URL이든 ZIP buffer든 같은 CollectionResult로 통일.
 * API route는 이 함수만 호출.
 */
import { collectRepo } from "./collector";
import { collectZip } from "./zip";
import type { CollectionResult } from "./collector";

export type ScanSourceInput =
  | { kind: "git"; url: string; timeoutMs?: number; maxFiles?: number }
  | { kind: "zip"; buffer: Buffer; filename: string; maxEntries?: number };

export async function collectSource(
  input: ScanSourceInput
): Promise<CollectionResult> {
  if (input.kind === "git") {
    return await collectRepo(input.url, {
      timeoutMs: input.timeoutMs,
      maxFiles: input.maxFiles,
    });
  }
  return await collectZip(input.buffer, {
    filename: input.filename,
    maxEntries: input.maxEntries,
  });
}
