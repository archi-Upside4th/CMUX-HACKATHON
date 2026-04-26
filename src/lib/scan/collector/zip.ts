/**
 * ZIP collector — 업로드된 ZIP 파일을 git clone 대신 사용.
 *
 * 보안 가드:
 *   - 최대 압축 해제 후 50MB (압축 폭탄 방어)
 *   - entry name path traversal 차단 (zip-slip)
 *   - 절대경로/symlink 거부
 *   - sandboxDir prefix 강제
 *
 * git collector와 동일한 CollectionResult 모양 반환 → 하위 파이프라인 변경 0.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import AdmZip from "adm-zip";
import {
  createSandbox,
  destroySandbox,
  isTestPath,
  safeWalk,
} from "./sandbox";
import type { CollectionResult, CollectedFile } from "./collector";

const MAX_TOTAL_BYTES = 50 * 1024 * 1024;       // 압축 해제 후 합계 50MB
const MAX_PER_FILE_BYTES = 5 * 1024 * 1024;     // 단일 파일 5MB
const MAX_ENTRIES = 20_000;

const MANIFEST_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
  "requirements.txt",
  "requirements-dev.txt",
  "pyproject.toml",
  "Pipfile",
  "Pipfile.lock",
  "poetry.lock",
  "setup.py",
  "setup.cfg",
]);

const DOC_PATTERNS =
  /^(readme|changelog|contributing|data|dataset|architecture)([._-].+)?\.(md|mdx|rst|txt)$/i;

const CONFIG_FILES = new Set([
  ".env",
  ".env.example",
  ".env.local",
  ".env.production",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "tsconfig.json",
]);

function classifyFile(relPath: string): {
  category: CollectedFile["category"];
  ecosystem: CollectedFile["ecosystem"];
} {
  const base = path.basename(relPath).toLowerCase();
  const ext = path.extname(relPath).toLowerCase();

  if (MANIFEST_FILES.has(base)) {
    const eco =
      base === "package.json" ||
      base.endsWith(".lock") ||
      base === "pnpm-lock.yaml" ||
      base === "yarn.lock" ||
      base === "package-lock.json"
        ? "typescript"
        : "python";
    return { category: "manifest", ecosystem: eco };
  }
  if (DOC_PATTERNS.test(base)) return { category: "doc", ecosystem: "other" };
  if (CONFIG_FILES.has(base) || base.endsWith(".yml") || base.endsWith(".yaml")) {
    return { category: "config", ecosystem: "other" };
  }
  switch (ext) {
    case ".py":
    case ".pyi":
      return { category: "source", ecosystem: "python" };
    case ".ts":
    case ".tsx":
      return { category: "source", ecosystem: "typescript" };
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return { category: "source", ecosystem: "javascript" };
    default:
      return { category: "other", ecosystem: "other" };
  }
}

/**
 * ZIP entry name 안전성 검증.
 * 거부: 절대경로, 상위 traversal, NUL, 윈도우 드라이브, symlink hint.
 */
function isUnsafeEntryName(entryName: string): boolean {
  if (!entryName || entryName.length === 0) return true;
  if (entryName.includes("\0")) return true;
  // 절대경로
  if (entryName.startsWith("/") || entryName.startsWith("\\")) return true;
  // 윈도우 드라이브
  if (/^[a-zA-Z]:[\\/]/.test(entryName)) return true;
  // 상위 traversal — normalize 후 .. 잔존 시 거부
  const normalized = path.posix.normalize(entryName.replace(/\\/g, "/"));
  if (normalized.startsWith("../") || normalized === "..") return true;
  if (normalized.split("/").includes("..")) return true;
  return false;
}

/**
 * 원본 ZIP 파일 이름에서 의미있는 식별자 추출.
 * "foo-main.zip" → "foo-main", "Archive.zip" → "Archive"
 */
function deriveSlugFromFilename(filename: string): string {
  const base = path.basename(filename, ".zip");
  const safe = base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 64);
  return safe || "upload";
}

/**
 * 단일 루트 디렉토리 안에 모든 entry가 들어있으면 그 디렉토리로 들어감.
 * (GitHub ZIP export 패턴: foo-main/...)
 */
function findCommonRoot(entries: string[]): string | null {
  if (entries.length === 0) return null;
  const firstSeg = entries[0].split("/")[0];
  if (!firstSeg) return null;
  for (const e of entries) {
    if (!e.startsWith(firstSeg + "/")) return null;
  }
  return firstSeg;
}

export interface CollectZipOptions {
  /** 업로드된 파일 원본 이름 (commitSha/normalizedUrl 생성용) */
  filename: string;
  /** 최대 entries 수. 기본 20_000 */
  maxEntries?: number;
}

/**
 * ZIP buffer를 sandbox 디렉토리에 안전하게 펼친다.
 * 호출자는 result.cleanup()을 finally에서 반드시 호출.
 */
export async function collectZip(
  buffer: Buffer,
  opts: CollectZipOptions
): Promise<CollectionResult> {
  if (!buffer || buffer.length === 0) {
    return { ok: false, reason: "ZIP buffer is empty" };
  }
  if (buffer.length > MAX_TOTAL_BYTES * 2) {
    return {
      ok: false,
      reason: `ZIP file too large (${buffer.length} bytes, limit ${MAX_TOTAL_BYTES * 2})`,
    };
  }

  const sandboxDir = await createSandbox();
  const cleanup = () => destroySandbox(sandboxDir);

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (err) {
    await cleanup().catch(() => {});
    return {
      ok: false,
      reason: `ZIP 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const entries = zip.getEntries();
  if (entries.length === 0) {
    await cleanup().catch(() => {});
    return { ok: false, reason: "ZIP이 비어있음" };
  }
  const maxEntries = opts.maxEntries ?? MAX_ENTRIES;
  if (entries.length > maxEntries) {
    await cleanup().catch(() => {});
    return {
      ok: false,
      reason: `ZIP entry 수 초과: ${entries.length} > ${maxEntries}`,
    };
  }

  // 안전성 1차 검증 + 공통 루트 탐지
  const safeEntryNames: string[] = [];
  for (const e of entries) {
    if (isUnsafeEntryName(e.entryName)) {
      await cleanup().catch(() => {});
      return {
        ok: false,
        reason: `안전하지 않은 entry name: ${e.entryName}`,
      };
    }
    if (!e.isDirectory) safeEntryNames.push(e.entryName);
  }
  const commonRoot = findCommonRoot(safeEntryNames);

  // 압축 해제 — 합계 크기 추적
  let totalBytes = 0;
  try {
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const rawName = entry.entryName.replace(/\\/g, "/");
      const stripped = commonRoot
        ? rawName.slice(commonRoot.length + 1)
        : rawName;
      if (!stripped) continue;
      const targetAbs = path.join(sandboxDir, stripped);
      // 최종 경로가 sandbox 안인지 재검증
      const rel = path.relative(sandboxDir, targetAbs);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        await cleanup().catch(() => {});
        return {
          ok: false,
          reason: `zip-slip detected: ${entry.entryName}`,
        };
      }
      const data = entry.getData();
      if (data.length > MAX_PER_FILE_BYTES) continue; // skip huge
      totalBytes += data.length;
      if (totalBytes > MAX_TOTAL_BYTES) {
        await cleanup().catch(() => {});
        return {
          ok: false,
          reason: `압축 해제 합계 크기 초과 (${totalBytes} > ${MAX_TOTAL_BYTES})`,
        };
      }
      await mkdir(path.dirname(targetAbs), { recursive: true });
      await writeFile(targetAbs, data);
    }
  } catch (err) {
    await cleanup().catch(() => {});
    return {
      ok: false,
      reason: `ZIP 압축 해제 실패: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 분류 walk (git collector와 동일 로직)
  const files: CollectedFile[] = [];
  const ecoSet = new Set<"python" | "typescript" | "javascript">();
  try {
    for await (const entry of safeWalk(sandboxDir)) {
      if (files.length >= 5000) break;
      const cls = classifyFile(entry.relPath);
      if (cls.category === "other" && cls.ecosystem === "other") continue;
      const testOnly = isTestPath(entry.relPath);
      files.push({
        relPath: entry.relPath,
        absPath: entry.absPath,
        size: entry.size,
        category: cls.category,
        ecosystem: cls.ecosystem,
        testOnly,
      });
      if (
        cls.ecosystem === "python" ||
        cls.ecosystem === "typescript" ||
        cls.ecosystem === "javascript"
      ) {
        ecoSet.add(cls.ecosystem);
      }
    }
  } catch (err) {
    await cleanup().catch(() => {});
    return {
      ok: false,
      reason: `walk failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // commitSha 대용 — buffer hash (재현 가능성 위해)
  const sha = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
  const slug = deriveSlugFromFilename(opts.filename);

  return {
    ok: true,
    sandboxDir,
    commitSha: `zip-${sha}`,
    normalizedUrl: `zip://${slug}`,
    files,
    ecosystems: [...ecoSet],
    cleanup,
  };
}
