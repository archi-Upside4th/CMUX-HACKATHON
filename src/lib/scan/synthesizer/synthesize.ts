/**
 * Synthesizer — Finding[] + Catalog → AISystem[]
 * MVP: 결정적 그룹화 + 카탈로그 추론 + Risk tier + Obligation attach
 *      (Gemini refine은 후속 단계)
 */
import { createHash } from "node:crypto";
import type { ScanReport, Finding } from "../inputs/finding";
import type { AISystem, RiskTier, EvidenceRef } from "./schema";
import { loadCatalog } from "../catalog/loader";
import { CODE_PATTERN_RULES_BY_ID } from "../rules/code-patterns";
import { groupFindings, type FindingGroup } from "./grouping";
import type {
  CatalogEntry,
  Domain,
  ObligationId,
  Confidence,
} from "../catalog/schema";

const HIGH_IMPACT_DOMAINS = new Set<Domain>([
  "credit_finance",
  "employment",
  "healthcare",
  "biometric_id",
  "law_enforcement",
]);

const KOREAN_MODEL_PREFIXES = [
  "upstage/",
  "solar-",
  "lgai-exaone/",
  "exaone-",
  "naver/",
  "kt-",
  "hcx-",
];

export interface SynthesisResult {
  systems: AISystem[];
  unattributedFindings: Finding[]; // catalogEntryId 없는 code_pattern 등
}

export async function synthesizeSystems(
  report: ScanReport
): Promise<SynthesisResult> {
  const idx = await loadCatalog();
  const groups = groupFindings(report.findings);

  // 그룹별 Finding 외에 codePattern Finding은 dirRoot 단위로 추가 attach
  const codePatternsByDir = new Map<string, Finding[]>();
  for (const f of report.findings) {
    if (f.kind !== "code_pattern" || !f.ruleId) continue;
    if (f.testOnly) continue;
    const dirRoot = topLevelRouteCached(f.filePath);
    const arr = codePatternsByDir.get(dirRoot) ?? [];
    arr.push(f);
    codePatternsByDir.set(dirRoot, arr);
  }

  const systems: AISystem[] = [];
  for (const g of groups) {
    const entry = idx.byId.get(g.catalogEntryId);
    if (!entry) continue;
    const codePatternFindings = codePatternsByDir.get(g.dirRoot) ?? [];
    const sys = buildSystem(g, entry, codePatternFindings);
    systems.push(sys);
  }

  const unattributed = report.findings.filter(
    (f) => !f.catalogEntryId && f.ruleId
  );

  return { systems, unattributedFindings: unattributed };
}

function topLevelRouteCached(filePath: string): string {
  // grouping.ts와 동일 — 인라인
  const norm = filePath.replace(/\\/g, "/");
  const m1 = norm.match(/(?:^|\/)(?:app|pages)\/api\/([^\/]+)/);
  if (m1) return `route:${m1[1]}`;
  const m2 = norm.match(/(?:^|\/)(?:src|lib|services|apps)\/([^\/]+)/);
  if (m2) return `mod:${m2[1]}`;
  const segs = norm.split("/").filter(Boolean);
  if (segs.length >= 2) return `dir:${segs[0]}`;
  return "root";
}

function buildSystem(
  group: FindingGroup,
  entry: CatalogEntry,
  codePatternFindings: Finding[]
): AISystem {
  const inf = entry.inferences;

  // === domains: catalog hint + code-pattern enrichment ===
  const domains = new Set<Domain>(inf.domainHints);
  let setIsGenerative: boolean | undefined;
  let setTrainsOrFineTunes: boolean | undefined;
  for (const f of codePatternFindings) {
    const rule = CODE_PATTERN_RULES_BY_ID.get(f.ruleId!);
    if (!rule?.enriches) continue;
    for (const d of rule.enriches.domains ?? []) domains.add(d);
    if (rule.enriches.setIsGenerative) setIsGenerative = true;
    if (rule.enriches.setTrainsOrFineTunes) setTrainsOrFineTunes = true;
  }

  // === isForeignModel: catalog + 한국 모델 prefix 보정 ===
  let isForeign = inf.isForeignModel ?? false;
  const modelLower = group.modelName?.toLowerCase() ?? "";
  if (
    KOREAN_MODEL_PREFIXES.some((p) => modelLower.startsWith(p))
  ) {
    isForeign = false;
  }

  const isGenerative = setIsGenerative ?? inf.isGenerative;
  const trainsOrFineTunes = setTrainsOrFineTunes ?? inf.trainsOrFineTunes;

  // === risk tier ===
  const hasHighImpactDomain = [...domains].some((d) =>
    HIGH_IMPACT_DOMAINS.has(d)
  );
  const isFullyAuto = inf.autonomyHint === "fully_automated";
  const tier: RiskTier =
    hasHighImpactDomain && (isFullyAuto || !isGenerative)
      ? "high"
      : isGenerative
        ? "medium"
        : "low";

  // === triggered obligations ===
  const trig = new Set<ObligationId>(inf.autoTriggeredObligations);
  trig.add("AIBA-RISK-MGMT");
  if (isGenerative) trig.add("AIBA-NOTICE");
  // FOREIGN-REP 보정: 한국 모델이면 제거
  if (!isForeign) trig.delete("AIBA-FOREIGN-REP");
  // conditional obligations — 룰 매칭 여부
  const matchedRuleIds = new Set(codePatternFindings.map((f) => f.ruleId!));
  for (const co of inf.conditionalObligations) {
    if (matchedRuleIds.has(co.requiresPattern)) trig.add(co.obligationId);
  }
  // pure code-pattern triggers (예: pattern.sensitive_domain_keywords.credit → HIGH-IMPACT)
  for (const f of codePatternFindings) {
    const rule = CODE_PATTERN_RULES_BY_ID.get(f.ruleId!);
    if (!rule) continue;
    for (const o of rule.triggersObligations) trig.add(o);
  }
  if (tier === "high") {
    trig.add("AIBA-HIGH-IMPACT");
    trig.add("AIBA-IMPACT-ASSESSMENT");
  }
  if (trainsOrFineTunes) trig.add("AIBA-DATA-GOVERNANCE");

  // === confidence ===
  const kinds = new Set(group.findings.map((f) => f.kind));
  // dead-code 강등: import만 있고 env_var/call/api_host 없음 → 한 단계 ↓
  let confidence: Confidence = entry.confidence;
  if (
    kinds.has("import") &&
    !kinds.has("env_var") &&
    !kinds.has("call") &&
    !kinds.has("api_host")
  ) {
    confidence = downgrade(confidence);
  }
  // manifest_dep만 있고 import 0건 → 더 강등
  if (kinds.size === 1 && kinds.has("manifest_dep")) {
    confidence = downgrade(downgrade(confidence));
  }

  // === evidence ===
  const evidence: EvidenceRef = {
    catalogEntryIds: [entry.id],
    ruleIds: [...matchedRuleIds],
    filePaths: uniq([
      ...group.findings.map((f) => f.filePath),
      ...codePatternFindings.map((f) => f.filePath),
    ]),
  };

  // === name & purpose ===
  const dirHint = group.dirRoot.replace(/^(route|mod|dir):/, "");
  const name =
    group.modelName != null && group.modelName.length > 0
      ? `${entry.nameKo} (${group.modelName})`
      : entry.nameKo;
  const purpose = `${dirHint} 모듈에서 ${entry.nameKo} 사용`;

  // 의무가 1개 이상이고 프로덕션 추정 (대부분의 경우) → PUBLIC-DISCLOSURE 후보
  // MVP에서는 high-tier만 추가
  if (tier === "high") trig.add("AIBA-PUBLIC-DISCLOSURE");

  const id = "synth-" + sha1(group.key).slice(0, 10);

  return {
    id,
    name,
    purpose,
    catalogEntryId: entry.id,
    procurement: inf.procurement,
    modelProvider: inf.modelProvider,
    modelName: group.modelName,
    isForeignModel: isForeign,
    domains: [...domains],
    modalities: inf.modalities,
    isGenerative,
    autonomy: inf.autonomyHint,
    trainsOrFineTunes,
    derivedRiskTier: tier,
    triggeredObligations: [...trig],
    confidence,
    evidence,
  };
}

function downgrade(c: Confidence): Confidence {
  return c === "high" ? "medium" : c === "medium" ? "low" : "low";
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}
