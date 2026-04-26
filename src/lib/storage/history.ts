/**
 * 스캔/진단 이력 — localStorage 기반 (MVP).
 * 추후 Supabase/SQLite로 갈아끼울 수 있도록 함수 인터페이스로 추상화.
 *
 * - 클라이언트 전용. SSR에서는 호출하지 않음 (typeof window 가드).
 * - 최신 50건만 보존 (FIFO).
 */

const STORAGE_KEY = "lexos:history:v1";
const MAX_ENTRIES = 50;

export type HistoryType = "scan" | "diagnose";

export interface HistoryEntryInput {
  type: HistoryType;
  title: string; // repo URL or company name
  overallRisk: string; // "high" | "medium" | "low" | "none"
  systemCount?: number;
  obligationCount?: number;
  payload: unknown; // 원본 응답 JSON
}

export interface HistoryEntry extends HistoryEntryInput {
  id: string;
  createdAt: string; // ISO
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readAll(): HistoryEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: HistoryEntry[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    // QuotaExceededError 등 — 가장 오래된 것 절반 삭제 후 재시도
    try {
      const trimmed = entries.slice(0, Math.floor(entries.length / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      console.error("[history] localStorage write failed", e);
    }
  }
}

function genId(): string {
  return (
    "h-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

export function saveEntry(input: HistoryEntryInput): HistoryEntry {
  const entry: HistoryEntry = {
    ...input,
    id: genId(),
    createdAt: new Date().toISOString(),
  };
  const all = readAll();
  all.unshift(entry);
  writeAll(all.slice(0, MAX_ENTRIES));
  return entry;
}

export function listEntries(): HistoryEntry[] {
  return readAll();
}

export function listByType(type: HistoryType): HistoryEntry[] {
  return readAll().filter((e) => e.type === type);
}

export function getEntry(id: string): HistoryEntry | null {
  return readAll().find((e) => e.id === id) ?? null;
}

export function deleteEntry(id: string): void {
  const all = readAll().filter((e) => e.id !== id);
  writeAll(all);
}

export function clearAll(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
}
