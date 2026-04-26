import { NextRequest } from "next/server";
import { CompanyProfileSchema } from "@/lib/types";
import { diagnoseAIBasicAct } from "@/lib/gemini/diagnose";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 파싱 실패" }, { status: 400 });
  }

  const parsed = CompanyProfileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "입력 검증 실패", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await diagnoseAIBasicAct(parsed.data);
    return Response.json({ ok: true, profile: parsed.data, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[diagnose]", msg);
    return Response.json({ error: "진단 실패", detail: msg }, { status: 500 });
  }
}
