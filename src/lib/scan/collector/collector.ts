/**
 * Collector — git clone → safeWalk → 파일 분류 (manifest/source/doc).
 * 정적 분석기/컨텍스트 추출기는 별도 단계 (Phase 1.5.2~3).
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  createSandbox,
  destroySandbox,
  isTestPath,
  safeWalk,
} from "./sandbox";
import { cloneRepo } from "./git";

export type CollectedFile = {
  relPath: string;
  absPath: string;
  size: number;
  category: "manifest" | "source" | "doc" | "config" | "other";
  ecosystem: "python" | "typescript" | "javascript" | "other";
  testOnly: boolean;
};

export type CollectionResult = {
  ok: true;
  sandboxDir: string;
  commitSha: string;
  normalizedUrl: string;
  files: CollectedFile[];
  ecosystems: Array<"python" | "typescript" | "javascript">;
  cleanup: () => Promise<void>;
} | {
  ok: false;
  reason: string;
  stderr?: string;
};

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

const DOC_PATTERNS = /^(readme|changelog|contributing|data|dataset|architecture)([._-].+)?\.(md|mdx|rst|txt)$/i;

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
      base === "package.json" || base.endsWith(".lock") || base === "pnpm-lock.yaml" || base === "yarn.lock" || base === "package-lock.json"
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
 * 1회 사용 컬렉션. 호출자는 result.cleanup()을 finally에서 반드시 호출해야 함.
 */
export async function collectRepo(
  repoUrl: string,
  opts: { timeoutMs?: number; maxFiles?: number } = {}
): Promise<CollectionResult> {
  const sandboxDir = await createSandbox();
  const cleanup = () => destroySandbox(sandboxDir);

  let cloneRes;
  try {
    cloneRes = await cloneRepo(repoUrl, sandboxDir, {
      timeoutMs: opts.timeoutMs,
    });
  } catch (err) {
    await cleanup().catch(() => {});
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  if (!cloneRes.ok) {
    await cleanup().catch(() => {});
    return cloneRes;
  }

  const maxFiles = opts.maxFiles ?? 5000;
  const files: CollectedFile[] = [];
  const ecoSet = new Set<"python" | "typescript" | "javascript">();

  try {
    for await (const entry of safeWalk(sandboxDir)) {
      if (files.length >= maxFiles) break;
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
      if (cls.ecosystem === "python" || cls.ecosystem === "typescript" || cls.ecosystem === "javascript") {
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

  return {
    ok: true,
    sandboxDir,
    commitSha: cloneRes.commitSha,
    normalizedUrl: cloneRes.normalizedUrl,
    files,
    ecosystems: [...ecoSet],
    cleanup,
  };
}

/** 호출자 편의: 파일 텍스트 읽기 (UTF-8, 크기 제한). */
export async function readCollectedFile(
  file: CollectedFile,
  maxBytes = 256 * 1024
): Promise<string | null> {
  if (file.size > maxBytes) return null;
  try {
    return await readFile(file.absPath, "utf8");
  } catch {
    return null;
  }
}
