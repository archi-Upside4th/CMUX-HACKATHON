/**
 * 외부 코드 수집 샌드박스 — git clone 시 보안 경계.
 * 핵심:
 *  - hooks 비활성 (악성 post-checkout 등 차단)
 *  - file/SSH protocol 차단 (file:// → 로컬 파일 read)
 *  - blob size 제한 (대용량 차단)
 *  - 작업 디렉토리는 OS 임시 + 격리 prefix
 *  - symlink 거부, vendored 디렉토리 자동 제외
 */
import { mkdtemp, rm, lstat, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const SANDBOX_PREFIX = "lexos-scan-";

// 인프라 안전 환경변수 (git에 강제 주입)
export const GIT_SAFE_ENV: Record<string, string> = {
  // hooks 차단
  GIT_TERMINAL_PROMPT: "0",
  // SSH/credential 프롬프트 차단
  GIT_ASKPASS: "/bin/echo",
  SSH_ASKPASS: "/bin/echo",
  // sub-process 비활성
  GIT_LFS_SKIP_SMUDGE: "1",
};

// git clone 보안 플래그
export const GIT_SECURE_ARGS: string[] = [
  "-c",
  "core.hooksPath=/dev/null", // 모든 hook 무력화
  "-c",
  "protocol.file.allow=never", // file:// 차단
  "-c",
  "protocol.ext.allow=never", // ext:: 차단
  "-c",
  "uploadpack.allowFilter=true",
  "-c",
  "core.symlinks=false", // 클론 단계 symlink 차단
];

export const CLONE_FILTER_ARGS: string[] = [
  "--depth=1",
  "--single-branch",
  "--no-tags",
  "--filter=blob:limit=10m",
];

const ALLOWED_HOSTS = new Set([
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "codeberg.org",
]);

export type RepoUrlValidation =
  | { ok: true; normalized: string; host: string; owner: string; repo: string }
  | { ok: false; reason: string };

export function validateRepoUrl(input: string): RepoUrlValidation {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "URL 파싱 실패" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "https:// 만 허용 (ssh/git/file 차단)" };
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return {
      ok: false,
      reason: `허용된 호스트가 아닙니다: ${url.hostname} (허용: ${[...ALLOWED_HOSTS].join(", ")})`,
    };
  }
  // 경로: /owner/repo(.git)?
  const segments = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
  if (segments.length < 2) {
    return { ok: false, reason: "경로 형식 오류 — /owner/repo 필요" };
  }
  const [owner, repo] = segments;
  // 경로 traversal/특수문자 거부
  if (!/^[A-Za-z0-9._-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) {
    return { ok: false, reason: "owner/repo 이름에 허용되지 않은 문자" };
  }
  const normalized = `https://${url.hostname}/${owner}/${repo}.git`;
  return { ok: true, normalized, host: url.hostname, owner, repo };
}

export async function createSandbox(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), SANDBOX_PREFIX));
}

export async function destroySandbox(dir: string): Promise<void> {
  // 안전장치: 우리가 만든 prefix만 삭제
  if (!dir.includes(SANDBOX_PREFIX)) {
    throw new Error(`refuse to remove non-sandbox path: ${dir}`);
  }
  await rm(dir, { recursive: true, force: true });
}

// vendored / 자동 제외 디렉토리
export const EXCLUDED_DIRS = new Set([
  "node_modules",
  "vendor",
  ".venv",
  "venv",
  "env",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  ".git",
]);

export const TEST_DIRS = new Set([
  "test",
  "tests",
  "__tests__",
  "__mocks__",
  "spec",
  "fixtures",
  "examples",
  "docs",
]);

export function isExcludedPath(relPath: string): boolean {
  const segs = relPath.split(path.sep);
  return segs.some((s) => EXCLUDED_DIRS.has(s));
}

export function isTestPath(relPath: string): boolean {
  const segs = relPath.split(path.sep);
  return segs.some((s) => TEST_DIRS.has(s.toLowerCase()));
}

/** 안전 walk — symlink 거부, 제외 디렉토리 skip, 파일 크기 제한. */
export async function* safeWalk(
  root: string,
  opts: { maxBytes?: number } = {}
): AsyncGenerator<{ absPath: string; relPath: string; size: number }> {
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024; // 파일당 5MB

  async function* walk(dir: string): AsyncGenerator<{
    absPath: string;
    relPath: string;
    size: number;
  }> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const abs = path.join(dir, name);
      const rel = path.relative(root, abs);
      if (isExcludedPath(rel)) continue;

      let lst;
      try {
        lst = await lstat(abs);
      } catch {
        continue;
      }
      // symlink 거부
      if (lst.isSymbolicLink()) continue;

      if (lst.isDirectory()) {
        yield* walk(abs);
      } else if (lst.isFile()) {
        let st;
        try {
          st = await stat(abs);
        } catch {
          continue;
        }
        if (st.size > maxBytes) continue;
        yield { absPath: abs, relPath: rel, size: st.size };
      }
      // block device, FIFO 등은 무시
    }
  }
  yield* walk(root);
}
