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

export function geminiClient(): GoogleGenAI {
  if (!_clients) {
    _keys = loadKeys();
    _clients = _keys.map((apiKey) => new GoogleGenAI({ apiKey }));
  }
  const client = _clients[_cursor % _clients.length];
  _cursor = (_cursor + 1) % _clients.length;
  return client;
}

export const DIAGNOSIS_MODEL = "gemini-2.5-flash";
