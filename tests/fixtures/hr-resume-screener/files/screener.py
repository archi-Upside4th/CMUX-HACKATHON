"""Resume / candidate auto-screener — AIBA-HIGH-IMPACT (employment domain).

채용 자동심사 — resume, candidate, hiring_decision 키워드로 employment 도메인 트리거.
"""
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def score_candidate_resume(resume_text: str) -> dict:
    """후보자 이력서 점수 매기기 + 채용/탈락 자동 결정."""
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You are an HR screening assistant. Score the resume 0-100 and decide hire/reject.",
            },
            {"role": "user", "content": resume_text},
        ],
    )
    return {"raw": resp.choices[0].message.content}


def make_hiring_decision(resume_score: float) -> str:
    """자동 채용 결정 — fully automated."""
    return "interview" if resume_score >= 70 else "reject"
