/**
 * Test helper — fixture 디렉토리를 진짜 git clone 결과처럼 보이게 만든다.
 * collector.ts의 classifyFile / safeWalk 동작을 미러링하되, 외부 의존 없음.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, stat } from "node:fs/promises";
import type {
  CollectedFile,
  CollectionResult,
} from "@/lib/scan/collector/collector";

const HERE = path.dirname(fileURLToPath(import.meta.url));

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

const TEST_PATH = /(^|\/)(tests?|__tests__|specs?)\//i;

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
  if (
    CONFIG_FILES.has(base) ||
    base.endsWith(".yml") ||
    base.endsWith(".yaml")
  ) {
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

async function* walk(
  root: string,
  rel = ""
): AsyncGenerator<{ relPath: string; absPath: string; size: number }> {
  const entries = await readdir(path.join(root, rel), { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".git")) continue;
    if (e.name === "node_modules" || e.name === ".next") continue;
    const sub = rel ? `${rel}/${e.name}` : e.name;
    const abs = path.join(root, sub);
    if (e.isDirectory()) {
      yield* walk(root, sub);
    } else if (e.isFile()) {
      const s = await stat(abs);
      yield { relPath: sub, absPath: abs, size: s.size };
    }
  }
}

/**
 * fixture 디렉토리(예: tests/fixtures/openai-foreign-llm/files)를
 * 실제 collector 결과 형태(`CollectionResult & { ok: true }`)로 변환.
 */
export async function loadFixture(
  fixtureSlug: string
): Promise<Extract<CollectionResult, { ok: true }>> {
  const root = path.resolve(HERE, "fixtures", fixtureSlug, "files");
  const files: CollectedFile[] = [];
  const ecoSet = new Set<"python" | "typescript" | "javascript">();

  for await (const entry of walk(root)) {
    const cls = classifyFile(entry.relPath);
    if (cls.category === "other" && cls.ecosystem === "other") continue;
    const testOnly = TEST_PATH.test(entry.relPath);
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

  return {
    ok: true,
    sandboxDir: root,
    commitSha: `fixture-${fixtureSlug}`,
    normalizedUrl: `fixture://${fixtureSlug}`,
    files,
    ecosystems: [...ecoSet],
    cleanup: async () => {},
  };
}
