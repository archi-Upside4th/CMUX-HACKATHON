/**
 * 안전한 git clone — sandbox.ts의 GIT_SAFE_ENV + GIT_SECURE_ARGS 강제 적용.
 * stdout/stderr 분리, 타임아웃, 종료 코드 검사.
 */
import { spawn } from "node:child_process";
import {
  CLONE_FILTER_ARGS,
  GIT_SAFE_ENV,
  GIT_SECURE_ARGS,
  validateRepoUrl,
} from "./sandbox";

export type GitCloneResult = {
  ok: true;
  commitSha: string;
  normalizedUrl: string;
} | {
  ok: false;
  reason: string;
  stderr?: string;
};

const DEFAULT_TIMEOUT_MS = 60_000; // 1분

function runGit(
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: opts.cwd,
      env: { ...process.env, ...GIT_SAFE_ENV },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout.on("data", (b) => {
      stdout += b.toString();
      if (stdout.length > 1_000_000) stdout = stdout.slice(-500_000);
    });
    child.stderr.on("data", (b) => {
      stderr += b.toString();
      if (stderr.length > 1_000_000) stderr = stderr.slice(-500_000);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`git ${args[0]} timeout`));
        return;
      }
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

export async function cloneRepo(
  repoUrl: string,
  destDir: string,
  opts: { timeoutMs?: number } = {}
): Promise<GitCloneResult> {
  const v = validateRepoUrl(repoUrl);
  if (!v.ok) return { ok: false, reason: v.reason };

  const args = [
    ...GIT_SECURE_ARGS,
    "clone",
    ...CLONE_FILTER_ARGS,
    v.normalized,
    destDir,
  ];

  let cloneOut;
  try {
    cloneOut = await runGit(args, { timeoutMs: opts.timeoutMs });
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  if (cloneOut.code !== 0) {
    return {
      ok: false,
      reason: `git clone failed (exit ${cloneOut.code})`,
      stderr: cloneOut.stderr.slice(0, 2000),
    };
  }

  // 커밋 SHA 추출
  let shaOut;
  try {
    shaOut = await runGit(["rev-parse", "HEAD"], {
      cwd: destDir,
      timeoutMs: 10_000,
    });
  } catch (err) {
    return {
      ok: false,
      reason: `rev-parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (shaOut.code !== 0) {
    return { ok: false, reason: "rev-parse failed", stderr: shaOut.stderr };
  }
  const commitSha = shaOut.stdout.trim();

  return { ok: true, commitSha, normalizedUrl: v.normalized };
}
