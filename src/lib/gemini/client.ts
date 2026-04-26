import { GoogleGenAI } from "@google/genai";

function loadKeys(): string[] {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter((k): k is string => typeof k === "string" && k.length > 0);
  if (keys.length === 0) {
    throw new Error(
      "GEMINI_API_KEY 환경변수가 없습니다. .env.local 파일을 확인하세요."
    );
  }
  return keys;
}

let _keys: string[] | null = null;
let _clients: GoogleGenAI[] | null = null;
let _cursor = 0;

function ensureClients(): GoogleGenAI[] {
  if (!_clients) {
    _keys = loadKeys();
    _clients = _keys.map((apiKey) => new GoogleGenAI({ apiKey }));
  }
  return _clients;
}

export function geminiClient(): GoogleGenAI {
  const clients = ensureClients();
  const client = clients[_cursor % clients.length];
  _cursor = (_cursor + 1) % clients.length;
  return client;
}

const RETRYABLE = /(403|429|expired|leaked|PERMISSION_DENIED|quota|RESOURCE_EXHAUSTED|UNAUTHENTICATED|invalid api key)/i;

/**
 * 등록된 모든 키를 한 바퀴 시도. 첫 번째 키가 만료/리크/quota이면 다음 키로 즉시 재시도.
 * 모두 실패하면 마지막 에러 throw. 키 1개만 등록돼 있으면 그 1번만 시도.
 */
export async function withGemini<T>(
  fn: (client: GoogleGenAI) => Promise<T>
): Promise<T> {
  const clients = ensureClients();
  let lastErr: unknown = null;
  for (let i = 0; i < clients.length; i++) {
    const client = clients[(_cursor + i) % clients.length];
    try {
      const result = await fn(client);
      _cursor = (_cursor + i + 1) % clients.length;
      return result;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!RETRYABLE.test(msg)) {
        throw e;
      }
      console.warn(
        `[gemini] key ${(_cursor + i) % clients.length} failed (${msg.slice(0, 120)}), trying next`
      );
    }
  }
  throw lastErr ?? new Error("Gemini 모든 키가 실패했습니다.");
}

export const DIAGNOSIS_MODEL = "gemini-2.5-flash";
