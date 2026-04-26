"""Solar Pro 챗봇 — 한국 모델 전용. AIBA-FOREIGN-REP은 트리거되면 안 됨."""
import os
from upstage import ChatUpstage

llm = ChatUpstage(api_key=os.environ["UPSTAGE_API_KEY"], model="solar-pro-2")


def reply(text: str) -> str:
    return llm.invoke(text)
