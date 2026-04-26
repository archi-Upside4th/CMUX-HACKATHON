import { GoogleGenAI } from "@google/genai";

let _client: GoogleGenAI | null = null;

export function geminiClient(): GoogleGenAI {
  if (_client) return _client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY 환경변수가 없습니다. .env 파일을 확인하세요."
    );
  }
  _client = new GoogleGenAI({ apiKey });
  return _client;
}

// 진단용 기본 모델 — 빠른 응답이 데모에 중요
export const DIAGNOSIS_MODEL = "gemini-2.5-flash";
