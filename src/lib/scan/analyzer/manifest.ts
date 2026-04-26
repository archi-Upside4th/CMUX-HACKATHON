/**
 * 매니페스트 파서 — package.json / requirements.txt / pyproject.toml에서 의존성 추출.
 * Tree-sitter 없이 단순 파서. (toml은 가벼운 정규식 — 정밀 파서 X)
 */
import path from "node:path";
import { readCollectedFile, type CollectedFile } from "../collector/collector";
import { loadCatalog } from "../catalog/loader";
import type { Finding } from "../inputs/finding";

export async function findingsFromManifests(
  files: CollectedFile[]
): Promise<Finding[]> {
  const idx = await loadCatalog();
  const out: Finding[] = [];

  for (const f of files) {
    if (f.category !== "manifest") continue;
    const txt = await readCollectedFile(f);
    if (!txt) continue;
    const base = path.basename(f.relPath).toLowerCase();

    let deps: string[] = [];
    try {
      if (base === "package.json") {
        deps = parsePackageJson(txt);
      } else if (base === "requirements.txt" || base.startsWith("requirements")) {
        deps = parseRequirementsTxt(txt);
      } else if (base === "pyproject.toml") {
        deps = parsePyprojectToml(txt);
      } else if (base === "pipfile") {
        deps = parsePipfile(txt);
      }
    } catch {
      continue;
    }

    for (const dep of deps) {
      const matches = idx.byManifestName.get(dep);
      if (!matches) continue;
      for (const entry of matches) {
        out.push({
          kind: "manifest_dep",
          catalogEntryId: entry.id,
          filePath: f.relPath,
          lineStart: 1,
          snippet: dep,
          confidence: f.testOnly ? "low" : "high",
          testOnly: f.testOnly,
        });
      }
    }
  }
  return out;
}

function parsePackageJson(txt: string): string[] {
  const pkg = JSON.parse(txt);
  const names = new Set<string>();
  for (const k of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const obj = pkg[k];
    if (obj && typeof obj === "object") {
      for (const name of Object.keys(obj)) names.add(name);
    }
  }
  return [...names];
}

function parseRequirementsTxt(txt: string): string[] {
  const out: string[] = [];
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("-")) continue;
    // package[extra]==1.2.3, package>=1.0, package
    const m = line.match(/^([A-Za-z0-9_.-]+)/);
    if (m) out.push(m[1]);
  }
  return out;
}

function parsePyprojectToml(txt: string): string[] {
  const out = new Set<string>();
  // [project] dependencies = ["pkg==1.0", ...]
  const projDeps = txt.match(/^\s*dependencies\s*=\s*\[([\s\S]*?)\]/m);
  if (projDeps) {
    for (const m of projDeps[1].matchAll(/["']([A-Za-z0-9_.-]+)/g)) {
      out.add(m[1]);
    }
  }
  // [tool.poetry.dependencies] foo = "..."
  const poetrySection = txt.match(
    /\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[|$)/
  );
  if (poetrySection) {
    for (const m of poetrySection[1].matchAll(/^\s*([A-Za-z0-9_.-]+)\s*=/gm)) {
      if (m[1] !== "python") out.add(m[1]);
    }
  }
  // [project.optional-dependencies] / [tool.poetry.dev-dependencies] 비슷한 처리
  const devSection = txt.match(
    /\[tool\.poetry\.dev-dependencies\]([\s\S]*?)(?=\n\[|$)/
  );
  if (devSection) {
    for (const m of devSection[1].matchAll(/^\s*([A-Za-z0-9_.-]+)\s*=/gm)) {
      if (m[1] !== "python") out.add(m[1]);
    }
  }
  return [...out];
}

function parsePipfile(txt: string): string[] {
  const out = new Set<string>();
  for (const section of ["packages", "dev-packages"]) {
    const re = new RegExp(`\\[${section}\\]([\\s\\S]*?)(?=\\n\\[|$)`);
    const m = txt.match(re);
    if (!m) continue;
    for (const dep of m[1].matchAll(/^\s*([A-Za-z0-9_.-]+)\s*=/gm)) {
      out.add(dep[1]);
    }
  }
  return [...out];
}
