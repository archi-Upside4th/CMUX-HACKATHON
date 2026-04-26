"""Minimal OpenAI chatbot — fixture for AIBA-NOTICE/RISK-MGMT/FOREIGN-REP."""
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def reply(user_message: str) -> str:
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": user_message}],
    )
    return resp.choices[0].message.content


if __name__ == "__main__":
    print(reply("안녕"))
