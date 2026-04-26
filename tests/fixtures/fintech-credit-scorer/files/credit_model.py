"""Credit scoring model — AIBA-HIGH-IMPACT 대상.

신용평가 자동심사 (loan approval). credit_score, credit_limit, default_probability 등
민감 도메인 키워드를 사용하여 도메인 룰이 트리거되어야 한다.
"""
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
import pandas as pd
import joblib


def train_credit_score_model(df: pd.DataFrame):
    X = df.drop(columns=["default"])
    y = df["default"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
    model = GradientBoostingClassifier(n_estimators=200, max_depth=4)
    model.fit(X_train, y_train)
    joblib.dump(model, "credit_score_model.pkl")
    return model


def predict_default_probability(model, applicant_features) -> float:
    """대출 승인 자동심사 — credit_score, credit_limit 기반 default_probability 산출."""
    proba = model.predict_proba([applicant_features])[0][1]
    return float(proba)


def loan_decision(credit_score: float, default_probability: float) -> str:
    """자동 대출 승인/거절 — fully_automated decision."""
    if credit_score >= 700 and default_probability < 0.1:
        return "approved"
    return "rejected"
