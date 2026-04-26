/**
 * Repo Context Collector — Gemini 호출 0회. 디스크 I/O + regex만.
 *
 * 입력: CollectionResult (이미 클론된 sandboxDir + 파일 목록)
 *      + AISystem[] (synthesizer 결과 — 호출 스니펫 추출 대상)
 * 출력: RepoContext (서비스가 무엇인지 추론할 신호 번들)
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { CollectionResult, CollectedFile } from "../collector/collector";
import type { AISystem } from "../synthesizer/schema";
import type {
  RepoContext,
  Route,
  SystemCallContext,
  SystemCallSite,
} from "@/lib/report/schema";

const README_BYTES = 5_000;
const MAX_ROUTES = 100;
const MAX_PAGES = 100;
const MAX_CALL_SITES_PER_SYSTEM = 6;
const SNIPPET_LINES_BEFORE = 12;
const SNIPPET_LINES_AFTER = 12;

type Collected = Extract<CollectionResult, { ok: true }>;

export async function collectRepoContext(
  collected: Collected,
  systems: AISystem[]
): Promise<RepoContext> {
  const ctx: RepoContext = {
    keywords: [],
    packageManagers: [],
    scripts: {},
    publicRoutes: [],
    pages: [],
    authMechanism: "unknown",
    schemaFiles: [],
    envVarsDeclared: [],
    storageBackends: [],
    readmeExcerpt: "",
    systemCallContexts: [],
  };

  const filesByRel = new Map<string, CollectedFile>();
  for (const f of collected.files) filesByRel.set(f.relPath, f);

  // === 1) README ===
  const readme = findFirst(filesByRel, [
    "README.md",
    "readme.md",
    "README.MD",
    "README.rst",
    "README",
  ]);
  if (readme) {
    try {
      const buf = await readFile(readme.absPath);
      ctx.readmeExcerpt = buf.subarray(0, README_BYTES).toString("utf8");
    } catch {}
  }

  // === 2) 매니페스트 ===
  await readManifest(filesByRel, ctx);

  // === 3) 라우트 / 페이지 / 인증 ===
  detectRoutesAndPages(collected.files, ctx);
  ctx.authMechanism = detectAuth(collected.files);

  // === 4) 스키마 파일 / 스토리지 ===
  detectSchemaFiles(collected.files, ctx);
  ctx.storageBackends = detectStorageBackends(collected.files);

  // === 5) .env.example 변수 선언 ===
  await readEnvExample(filesByRel, ctx);

  // === 6) 시스템별 호출 스니펫 ===
  ctx.systemCallContexts = await extractCallContexts(collected, systems);

  return ctx;
}

// ──────────────────────────────────────────────────────────
// 1) Manifest
// ──────────────────────────────────────────────────────────
async function readManifest(
  filesByRel: Map<string, CollectedFile>,
  ctx: RepoContext
): Promise<void> {
  const pkg = filesByRel.get("package.json");
  if (pkg) {
    try {
      const j = JSON.parse(await readFile(pkg.absPath, "utf8")) as Record<
        string,
        unknown
      >;
      if (typeof j.name === "string") ctx.serviceName = j.name;
      if (typeof j.description === "string")
        ctx.serviceDescription = j.description;
      if (Array.isArray(j.keywords))
        ctx.keywords = j.keywords.filter((k): k is string => typeof k === "string");
      if (j.scripts && typeof j.scripts === "object") {
        for (const [k, v] of Object.entries(j.scripts as Record<string, unknown>)) {
          if (typeof v === "string") ctx.scripts[k] = v;
        }
      }
      ctx.packageManagers.push("npm");
    } catch {}
  }

  const pyproj = filesByRel.get("pyproject.toml");
  if (pyproj) {
    try {
      const text = await readFile(pyproj.absPath, "utf8");
      const nameMatch = text.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
      const descMatch = text.match(/^\s*description\s*=\s*["']([^"']+)["']/m);
      if (nameMatch && !ctx.serviceName) ctx.serviceName = nameMatch[1];
      if (descMatch && !ctx.serviceDescription)
        ctx.serviceDescription = descMatch[1];
      ctx.packageManagers.push("python");
    } catch {}
  }

  if (filesByRel.has("requirements.txt") && !ctx.packageManagers.includes("python"))
    ctx.packageManagers.push("python");

  if (filesByRel.has("Cargo.toml")) ctx.packageManagers.push("cargo");
  if (filesByRel.has("go.mod")) ctx.packageManagers.push("go");
}

// ──────────────────────────────────────────────────────────
// 2) Routes / Pages
// ──────────────────────────────────────────────────────────
function detectRoutesAndPages(
  files: CollectedFile[],
  ctx: RepoContext
): void {
  for (const f of files) {
    if (f.testOnly) continue;
    const rel = f.relPath.replace(/\\/g, "/");

    // Next.js App Router: app/.../route.ts
    let m = rel.match(/(?:^|\/)app\/(.+)\/route\.[tj]sx?$/);
    if (m) {
      ctx.publicRoutes.push({
        method: "ALL",
        path: "/" + m[1],
        handlerFile: rel,
      });
      continue;
    }
    // Next.js Pages Router: pages/api/...
    m = rel.match(/(?:^|\/)pages\/api\/(.+)\.[tj]sx?$/);
    if (m) {
      ctx.publicRoutes.push({
        method: "ALL",
        path: "/api/" + m[1],
        handlerFile: rel,
      });
      continue;
    }
    // Next.js page: app/.../page.tsx
    m = rel.match(/(?:^|\/)app\/(.+)\/page\.[tj]sx?$/);
    if (m) {
      ctx.pages.push("/" + m[1]);
      continue;
    }
    // Next.js root: app/page.tsx
    if (/(?:^|\/)app\/page\.[tj]sx?$/.test(rel)) {
      ctx.pages.push("/");
      continue;
    }
  }
  ctx.publicRoutes = ctx.publicRoutes.slice(0, MAX_ROUTES);
  ctx.pages = ctx.pages.slice(0, MAX_PAGES);
}

// ──────────────────────────────────────────────────────────
// 3) Auth
// ──────────────────────────────────────────────────────────
function detectAuth(
  files: CollectedFile[]
): RepoContext["authMechanism"] {
  const names = files.map((f) => f.relPath.toLowerCase());
  const all = names.join("\n");
  if (/next-auth|auth\.js|@auth\//.test(all)) return "session";
  if (/clerk|supabase\/auth|firebase\/auth/.test(all)) return "session";
  if (/jsonwebtoken|jose|pyjwt|jwt-decode/.test(all)) return "jwt";
  if (/passport|express-session|flask-login/.test(all)) return "session";
  if (/oauth/.test(all)) return "oauth";
  if (names.some((n) => /middleware\.(t|j)sx?$/.test(n))) return "unknown";
  return "none";
}

// ──────────────────────────────────────────────────────────
// 4) Schema files / Storage backends
// ──────────────────────────────────────────────────────────
function detectSchemaFiles(files: CollectedFile[], ctx: RepoContext): void {
  for (const f of files) {
    if (f.testOnly) continue;
    const rel = f.relPath;
    if (/schema\.prisma$/i.test(rel))
      ctx.schemaFiles.push({ path: rel, kind: "prisma" });
    else if (/(?:^|\/)models\.py$/.test(rel))
      ctx.schemaFiles.push({ path: rel, kind: "django_models" });
    else if (/(?:^|\/)models\/.*\.py$/.test(rel))
      ctx.schemaFiles.push({ path: rel, kind: "sqlalchemy" });
    else if (/(?:^|\/)migrations\/.*\.(sql|py|ts|js)$/.test(rel))
      ctx.schemaFiles.push({ path: rel, kind: "raw_sql" });
    else if (/drizzle.*schema/i.test(rel))
      ctx.schemaFiles.push({ path: rel, kind: "drizzle" });
  }
}

function detectStorageBackends(files: CollectedFile[]): string[] {
  const found = new Set<string>();
  const all = files.map((f) => f.relPath.toLowerCase()).join("\n");
  if (/postgres|pg-?promise|psycopg/.test(all)) found.add("postgres");
  if (/mysql/.test(all)) found.add("mysql");
  if (/sqlite/.test(all)) found.add("sqlite");
  if (/redis|ioredis/.test(all)) found.add("redis");
  if (/mongodb|mongoose/.test(all)) found.add("mongodb");
  if (/aws-sdk\/client-s3|boto3|s3_client/.test(all)) found.add("s3");
  if (/supabase/.test(all)) found.add("supabase");
  if (/firebase/.test(all)) found.add("firebase");
  return [...found];
}

// ──────────────────────────────────────────────────────────
// 5) .env.example
// ──────────────────────────────────────────────────────────
async function readEnvExample(
  filesByRel: Map<string, CollectedFile>,
  ctx: RepoContext
): Promise<void> {
  const env = findFirst(filesByRel, [
    ".env.example",
    ".env.sample",
    ".env.template",
    "env.example",
  ]);
  if (!env) return;
  try {
    const text = await readFile(env.absPath, "utf8");
    const vars: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]+)\s*=/);
      if (m) vars.push(m[1]);
    }
    ctx.envVarsDeclared = vars.slice(0, 60);
  } catch {}
}

// ──────────────────────────────────────────────────────────
// 6) System call context — 시스템별 ±20줄 스니펫 + enclosing handler
// ──────────────────────────────────────────────────────────
async function extractCallContexts(
  collected: Collected,
  systems: AISystem[]
): Promise<SystemCallContext[]> {
  const out: SystemCallContext[] = [];

  // 시스템마다 evidence.filePaths 상위 N개에서 스니펫 추출.
  // 호출 라인은 모르지만, 파일을 읽고 첫 번째 의미있는 호출/import 라인을 잡아 ±N 줄을 떼어옴.
  for (const sys of systems) {
    const callSites: SystemCallSite[] = [];
    for (const rel of sys.evidence.filePaths.slice(0, MAX_CALL_SITES_PER_SYSTEM)) {
      const abs = path.join(collected.sandboxDir, rel);
      try {
        const text = await readFile(abs, "utf8");
        const lines = text.split(/\r?\n/);
        const lineIdx = pickInterestingLine(lines, sys);
        const start = Math.max(0, lineIdx - SNIPPET_LINES_BEFORE);
        const end = Math.min(lines.length, lineIdx + SNIPPET_LINES_AFTER + 1);
        const snippet = lines.slice(start, end).join("\n").slice(0, 1200);
        callSites.push({
          filePath: rel,
          lineStart: start + 1,
          snippet,
          enclosingHandler: detectEnclosingHandler(lines, lineIdx),
          dataInputHints: extractDataInputHints(lines, start, end),
        });
      } catch {
        // 파일 못 읽으면 메타만
        callSites.push({
          filePath: rel,
          lineStart: 1,
          snippet: "",
          dataInputHints: [],
        });
      }
    }
    if (callSites.length > 0) {
      out.push({ systemId: sys.id, callSites });
    }
  }
  return out;
}

function pickInterestingLine(lines: string[], sys: AISystem): number {
  // 우선순위: 모델명 등장 → 카탈로그 ID 키워드 → import/require/from
  const modelLower = sys.modelName?.toLowerCase();
  const provider = sys.modelProvider.toLowerCase();
  const eco = sys.catalogEntryId.split(".")[0]; // py / ts / kr
  const lib = sys.catalogEntryId.split(".")[1] ?? "";

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (modelLower && lower.includes(modelLower)) return i;
    if (lib && lower.includes(lib)) return i;
    if (provider && lower.includes(provider)) return i;
    if (eco === "py" && /^\s*(import|from)\s+/.test(lines[i])) return i;
    if ((eco === "ts" || eco === "js") && /^\s*import\s+/.test(lines[i]))
      return i;
  }
  return 0;
}

function detectEnclosingHandler(
  lines: string[],
  lineIdx: number
): string | undefined {
  // 위로 거슬러 올라가며 함수/메서드/export 핸들러 시그니처 찾기 (라인 30개 이내)
  const upper = Math.max(0, lineIdx - 30);
  const FN_PATTERNS = [
    /export\s+(?:async\s+)?function\s+([A-Z][A-Za-z0-9_]*)/,
    /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*=/,
    /^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)/,
    /^\s*export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/,
    /^\s*export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*=/,
  ];
  for (let i = lineIdx; i >= upper; i--) {
    for (const re of FN_PATTERNS) {
      const m = lines[i].match(re);
      if (m) return m[1];
    }
  }
  return undefined;
}

function extractDataInputHints(
  lines: string[],
  start: number,
  end: number
): string[] {
  const hints = new Set<string>();
  const blob = lines.slice(start, end).join("\n");
  const PATTERNS: Array<[RegExp, string]> = [
    [/req(?:uest)?\.body/i, "request.body"],
    [/req(?:uest)?\.json\(/i, "request.json"],
    [/req(?:uest)?\.query/i, "request.query"],
    [/req(?:uest)?\.params/i, "request.params"],
    [/searchParams/i, "url.searchParams"],
    [/formData/i, "form_data"],
    [/user\.(id|email|name|profile)/i, "user_profile"],
    [/session\./i, "session"],
    [/credit|loan|score|kyc/i, "financial_keywords"],
    [/resume|hiring|candidate|cv\b/i, "hr_keywords"],
    [/medical|diagnos|patient|symptom/i, "medical_keywords"],
    [/face|biometric|fingerprint/i, "biometric_keywords"],
    [/personal|pii|ssn|jumin/i, "pii_keywords"],
  ];
  for (const [re, label] of PATTERNS) if (re.test(blob)) hints.add(label);
  return [...hints];
}

// ──────────────────────────────────────────────────────────
// helpers
// ──────────────────────────────────────────────────────────
function findFirst(
  filesByRel: Map<string, CollectedFile>,
  candidates: string[]
): CollectedFile | undefined {
  for (const c of candidates) {
    const f = filesByRel.get(c);
    if (f) return f;
  }
  return undefined;
}
