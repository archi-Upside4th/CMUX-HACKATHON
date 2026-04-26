/**
 * 소스 코드 분석기 — regex 기반 (tree-sitter는 후순위).
 * - 카탈로그 importPatterns / callPatterns 매칭
 * - 환경변수 참조 검출
 * - CodePatternRule 매칭 (presence/absence)
 */
import { readCollectedFile, type CollectedFile } from "../collector/collector";
import { loadCatalog } from "../catalog/loader";
import { CODE_PATTERN_RULES } from "../rules/code-patterns";
import type { Finding } from "../inputs/finding";
import { minimatch } from "./glob";

const MAX_LINE = 5000; // 라인이 너무 긴 minified 파일 skip

export async function findingsFromSource(
  files: CollectedFile[]
): Promise<Finding[]> {
  const idx = await loadCatalog();
  const out: Finding[] = [];
  const sourceFiles = files.filter((f) => f.category === "source" || f.category === "config");

  // pre-compile env var regexes from catalog
  const envVarSet = new Map<string, string[]>(); // env name → catalog ids
  for (const e of idx.entries) {
    for (const v of e.patterns.envVars) {
      const ids = envVarSet.get(v) ?? [];
      ids.push(e.id);
      envVarSet.set(v, ids);
    }
  }
  const envVarPattern =
    envVarSet.size > 0
      ? new RegExp(`\\b(${[...envVarSet.keys()].map(escapeRegex).join("|")})\\b`)
      : null;

  for (const f of sourceFiles) {
    const txt = await readCollectedFile(f);
    if (!txt) continue;
    const lines = txt.split(/\r?\n/);
    if (lines.length > MAX_LINE) continue;

    // 1) Import patterns (per-line)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 1000) continue;
      for (const ip of idx.importPatterns) {
        if (matchesGlob(ip.entry.patterns.ecosystem, f) && ip.regex.test(line)) {
          out.push({
            kind: "import",
            catalogEntryId: ip.entry.id,
            filePath: f.relPath,
            lineStart: i + 1,
            snippet: line.slice(0, 500),
            confidence: f.testOnly ? "low" : "high",
            testOnly: f.testOnly,
          });
        }
      }
    }

    // 2) Call patterns (multi-line OK — apply on full text per pattern)
    for (const cp of idx.callPatterns) {
      if (!matchesGlob(cp.entry.patterns.ecosystem, f)) continue;
      // global regex — find all matches
      const rx = new RegExp(cp.regex.source, cp.regex.flags.includes("g") ? cp.regex.flags : cp.regex.flags + "g");
      let m: RegExpExecArray | null;
      while ((m = rx.exec(txt)) !== null) {
        const lineStart = lineNumberOf(txt, m.index);
        let modelName: string | undefined;
        if (cp.captureModel) {
          const grp = cp.captureGroup ?? 1;
          modelName = m[grp];
        }
        out.push({
          kind: "call",
          catalogEntryId: cp.entry.id,
          filePath: f.relPath,
          lineStart,
          snippet: m[0].slice(0, 500),
          extracted: modelName ? { modelName } : undefined,
          confidence: f.testOnly ? "low" : "high",
          testOnly: f.testOnly,
        });
        if (rx.lastIndex === m.index) rx.lastIndex++;
      }
    }

    // 3) Env vars
    if (envVarPattern && envVarPattern.test(txt)) {
      // collect all matches
      const rx = new RegExp(envVarPattern.source, "g");
      let m: RegExpExecArray | null;
      while ((m = rx.exec(txt)) !== null) {
        const env = m[1];
        const ids = envVarSet.get(env);
        if (!ids) continue;
        const lineStart = lineNumberOf(txt, m.index);
        for (const cid of ids) {
          out.push({
            kind: "env_var",
            catalogEntryId: cid,
            filePath: f.relPath,
            lineStart,
            snippet: env,
            confidence: f.testOnly ? "low" : "medium",
            testOnly: f.testOnly,
          });
        }
        if (rx.lastIndex === m.index) rx.lastIndex++;
      }
    }

    // 4) Code pattern rules (presence)
    for (const rule of CODE_PATTERN_RULES) {
      if (rule.kind !== "presence" && rule.kind !== "co_occurrence") continue;
      for (const pp of rule.presencePatterns) {
        if (pp.fileGlob && !minimatch(f.relPath, pp.fileGlob)) continue;
        if (pp.excludeGlob && minimatch(f.relPath, pp.excludeGlob)) continue;
        const rx = safeGlobalRegex(pp.pattern);
        if (!rx) continue;
        let m: RegExpExecArray | null;
        while ((m = rx.exec(txt)) !== null) {
          const lineStart = lineNumberOf(txt, m.index);
          out.push({
            kind: "code_pattern",
            ruleId: rule.id,
            filePath: f.relPath,
            lineStart,
            snippet: m[0].slice(0, 500),
            confidence: f.testOnly ? "low" : "medium",
            testOnly: f.testOnly,
          });
          if (rx.lastIndex === m.index) rx.lastIndex++;
        }
      }
    }
  }

  // 5) Absence rules — full repo scope (presence anywhere + absence everywhere)
  out.push(...(await applyAbsenceRules(sourceFiles, files)));

  return out;
}

async function applyAbsenceRules(
  sourceFiles: CollectedFile[],
  allFiles: CollectedFile[]
): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const rule of CODE_PATTERN_RULES) {
    if (rule.kind !== "absence") continue;

    // presence: 어느 한 파일에서라도 매치?
    let presenceHit: { file: CollectedFile; line: number } | null = null;
    for (const f of sourceFiles) {
      if (f.testOnly) continue;
      const txt = await readCollectedFile(f);
      if (!txt) continue;
      let hit = false;
      for (const pp of rule.presencePatterns) {
        const rx = safeGlobalRegex(pp.pattern);
        if (!rx) continue;
        const m = rx.exec(txt);
        if (m) {
          presenceHit = { file: f, line: lineNumberOf(txt, m.index) };
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (!presenceHit) continue;

    // absence: absencePatterns가 어느 파일에서도 매치 안 되면 → violation.
    // 단, fileGlob에 매치되는 후보 파일이 한 번이라도 read 실패하면
    // 부재를 확신할 수 없으므로 violation을 emit하지 않는다 (false positive 방지).
    let absenceHit = false;
    let unreadCandidates = 0;
    let readableCandidates = 0;
    for (const f of allFiles) {
      if (absenceHit) break;
      for (const ap of rule.absencePatterns) {
        if (ap.fileGlob && !minimatch(f.relPath, ap.fileGlob)) continue;
        const txt = await readCollectedFile(f);
        if (txt === null) {
          unreadCandidates++;
          continue;
        }
        readableCandidates++;
        const rx = safeGlobalRegex(ap.pattern);
        if (!rx) continue;
        if (rx.test(txt)) {
          absenceHit = true;
          break;
        }
      }
    }
    if (!absenceHit && readableCandidates > 0 && unreadCandidates === 0) {
      out.push({
        kind: "code_pattern",
        ruleId: rule.id,
        filePath: presenceHit.file.relPath,
        lineStart: presenceHit.line,
        snippet: `[absence rule] ${rule.descriptionKo}`,
        confidence: "medium",
        testOnly: false,
      });
    }
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeGlobalRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "g");
  } catch {
    return null;
  }
}

function lineNumberOf(text: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) n++;
  }
  return n;
}

function matchesGlob(
  ecosystem: "python" | "typescript" | "any",
  file: CollectedFile
): boolean {
  if (ecosystem === "any") return true;
  if (ecosystem === "python") return file.ecosystem === "python";
  if (ecosystem === "typescript")
    return file.ecosystem === "typescript" || file.ecosystem === "javascript";
  return false;
}
