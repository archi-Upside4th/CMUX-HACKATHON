/**
 * 카탈로그 로더 — entries/**\/*.yaml 모두 로드 + Zod 검증 + 룩업 인덱스 빌드.
 * 빌드/런타임 1회 로드, 결과 캐시.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { CatalogEntrySchema, type CatalogEntry } from "./schema";

const ENTRIES_DIR = path.join(
  process.cwd(),
  "src",
  "lib",
  "scan",
  "catalog",
  "entries"
);

export interface CatalogIndex {
  entries: CatalogEntry[];
  byId: Map<string, CatalogEntry>;
  byManifestName: Map<string, CatalogEntry[]>;
  byEnvVar: Map<string, CatalogEntry[]>;
  byApiHost: Map<string, CatalogEntry[]>;
  importPatterns: Array<{ regex: RegExp; entry: CatalogEntry }>;
  callPatterns: Array<{
    regex: RegExp;
    entry: CatalogEntry;
    captureModel: boolean;
    captureGroup?: number;
  }>;
}

// cache reset on HMR
let cache: CatalogIndex | null = null;

async function findYamlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await findYamlFiles(p)));
    } else if (e.isFile() && (e.name.endsWith(".yaml") || e.name.endsWith(".yml"))) {
      out.push(p);
    }
  }
  return out;
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

function pushMap<K, V>(map: Map<K, V[]>, key: K, val: V) {
  const arr = map.get(key);
  if (arr) arr.push(val);
  else map.set(key, [val]);
}

export async function loadCatalog(force = false): Promise<CatalogIndex> {
  if (cache && !force) return cache;

  const files = await findYamlFiles(ENTRIES_DIR);
  const entries: CatalogEntry[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const file of files) {
    let parsed;
    try {
      const txt = await readFile(file, "utf8");
      parsed = parseYaml(txt);
    } catch (err) {
      errors.push(`${path.relative(ENTRIES_DIR, file)}: parse failed - ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const result = CatalogEntrySchema.safeParse(parsed);
    if (!result.success) {
      errors.push(
        `${path.relative(ENTRIES_DIR, file)}: schema invalid - ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
      );
      continue;
    }
    if (seenIds.has(result.data.id)) {
      errors.push(`${path.relative(ENTRIES_DIR, file)}: duplicate id ${result.data.id}`);
      continue;
    }
    seenIds.add(result.data.id);
    entries.push(result.data);
  }

  if (errors.length > 0) {
    throw new Error(`Catalog load errors:\n  - ${errors.join("\n  - ")}`);
  }

  const byId = new Map<string, CatalogEntry>();
  const byManifestName = new Map<string, CatalogEntry[]>();
  const byEnvVar = new Map<string, CatalogEntry[]>();
  const byApiHost = new Map<string, CatalogEntry[]>();
  const importPatterns: CatalogIndex["importPatterns"] = [];
  const callPatterns: CatalogIndex["callPatterns"] = [];

  for (const entry of entries) {
    byId.set(entry.id, entry);
    for (const m of entry.patterns.manifestNames) pushMap(byManifestName, m, entry);
    for (const e of entry.patterns.envVars) pushMap(byEnvVar, e, entry);
    for (const h of entry.patterns.apiHosts) pushMap(byApiHost, h, entry);
    for (const p of entry.patterns.importPatterns) {
      const rx = safeRegex(p);
      if (rx) importPatterns.push({ regex: rx, entry });
    }
    for (const cp of entry.patterns.callPatterns) {
      const rx = safeRegex(cp.regex);
      if (rx)
        callPatterns.push({
          regex: rx,
          entry,
          captureModel: cp.captureModel,
          captureGroup: cp.captureGroup,
        });
    }
  }

  cache = {
    entries,
    byId,
    byManifestName,
    byEnvVar,
    byApiHost,
    importPatterns,
    callPatterns,
  };
  return cache;
}

/** 매니페스트 의존성 이름 → catalog 엔트리들 (다중 매칭 가능) */
export async function lookupManifest(name: string): Promise<CatalogEntry[]> {
  const idx = await loadCatalog();
  return idx.byManifestName.get(name) ?? [];
}

/** 환경변수 → catalog 엔트리들 */
export async function lookupEnvVar(envVar: string): Promise<CatalogEntry[]> {
  const idx = await loadCatalog();
  return idx.byEnvVar.get(envVar) ?? [];
}
