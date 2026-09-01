#!/usr/bin/env python3
"""Generate daily stock direction predictions and append to scoreboard."""
import json
import os
from datetime import datetime, date

import yfinance as _yf
import numpy as np
import pandas as pd

FRONTEND_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "frontend",
    "data",
    "stock-lab",
)
PREDICTIONS_PATH = os.path.join(FRONTEND_DATA_DIR, "predictions.json")
SCOREBOARD_PATH = os.path.join(FRONTEND_DATA_DIR, "scoreboard.json")

TICKERS = ["SPY", "AAPL", "MSFT", "GOOGL", "AMZN"]

MODELS = [
    "Naive Baseline",
    "Moving Average Crossover",
    "Small Regression",
    "ARIMA",
    "Headline Sentiment",
]


def load_json(path, default):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def moving_average_crossover_signal(hist: pd.DataFrame) -> str:
    if hist is None or hist.empty or "Close" not in hist.columns or len(hist) < 20:
        return "up"
    close = hist["Close"].dropna().astype(float)
    close = close[close > 0]
    if len(close) < 20:
        return "up"
    sma_fast = close.rolling(10).mean().iloc[-1]
    sma_slow = close.rolling(20).mean().iloc[-1]
    if np.isnan(sma_fast) or np.isnan(sma_slow):
        return "up"
    return "up" if sma_fast > sma_slow else "down"


def small_regression_signal(hist: pd.DataFrame) -> str:
    if hist is None or hist.empty or "Close" not in hist.columns or len(hist) < 10:
        return "up"
    close = hist["Close"].dropna().astype(float).tail(10).values
    x = np.arange(len(close))
    y = close
    x_mean = x.mean()
    y_mean = y.mean()
    denom = ((x - x_mean) ** 2).sum()
    if denom == 0:
        return "up"
    slope = ((x - x_mean) * (y - y_mean)).sum() / denom
    return "up" if slope > 0 else "down"


def arima_like_signal(hist: pd.DataFrame) -> str:
    if (
        hist is None
        or hist.empty
        or "Close" not in hist.columns
        or len(hist) < 15
    ):
        return "down"
    close = hist["Close"].dropna().astype(float).tail(15).values
    if len(close) < 15:
        return "down"
    lag1 = close[:-1]
    lag2 = close[:-2]
    y = close[2:]
    x = np.column_stack((lag1, lag2))
    x = np.column_stack((x, np.ones(len(x))))
    try:
        beta = np.linalg.lstsq(x, y, rcond=None)[0]
        next_x = np.array([close[-1], close[-2], 1.0])
        pred = next_x @ beta
    except Exception:
        return "down"
    return "up" if pred > close[-1] else "down"


def headline_sentiment_signal(ticker: str) -> str:
    try:
        t = _yf.Ticker(ticker)
        news = t.news or []
        scores = []
        for item in news[:5]:
            title = (item.get("title") or "") + " " + (item.get("summary") or "")
            title = title.lower()
            score = 0
            if any(w in title for w in ["beats", "jumps", "surges", "growth", "record", "upgrade", "profit"]):
                score += 1
            if any(w in title for w in ["misses", "drops", "falls", "loss", "cut", "slowdown", "downgrade", "down grade"]):
                score -= 1
            scores.append(score)
        if not scores:
            return "up"
        return "up" if sum(scores) >= 0 else "down"
    except Exception:
        return "up"


def generate_signals(ticker: str) -> dict:
    signals = {"Naive Baseline": "up"}
    try:
        hist = _yf.Ticker(ticker).history(period="3mo")
    except Exception:
        hist = None
    signals["Moving Average Crossover"] = moving_average_crossover_signal(hist)
    signals["Small Regression"] = small_regression_signal(hist)
    signals["ARIMA"] = arima_like_signal(hist)
    signals["Headline Sentiment"] = headline_sentiment_signal(ticker)
    return signals


def latest_close_direction(ticker: str) -> str:
    try:
        hist = _yf.Ticker(ticker).history(period="5d")
        if hist is None or hist.empty or len(hist) < 2 or "Close" not in hist.columns:
            return None
        closes = hist["Close"].dropna().astype(float)
        if len(closes) < 2:
            return None
        return "up" if closes.iloc[-1] >= closes.iloc[-2] else "down"
    except Exception:
        return None


def main():
    today = date.today().isoformat()
    predictions = load_json(PREDICTIONS_PATH, [])
    scoreboard = load_json(SCOREBOARD_PATH, [])

    # Avoid duplicate runs for the same date
    existing_dates = {p.get("date") for p in predictions}
    if today in existing_dates:
        print(f"Predictions already exist for {today}; skipping.")
        return

    new_predictions = []
    new_scoreboard = []

    for ticker in TICKERS:
        signals = generate_signals(ticker)
        actual = latest_close_direction(ticker)
        for model in MODELS:
            call = signals.get(model, "up")
            result = None
            if actual is not None:
                result = "correct" if call == actual else "miss"
            new_predictions.append(
                {
                    "date": today,
                    "model": model,
                    "ticker": ticker,
                    "call": call,
                    "actual": actual,
                    "result": result,
                }
            )
            new_scoreboard.append(
                {
                    "date": today,
                    "model": model,
                    "ticker": ticker,
                    "call": call,
                    "actual": actual,
                    "result": result,
                }
            )

    predictions.extend(new_predictions)
    scoreboard.extend(new_scoreboard)
    save_json(PREDICTIONS_PATH, predictions)
    save_json(SCOREBOARD_PATH, scoreboard)
    print(f"Wrote {len(new_predictions)} prediction entries for {today}.")


if __name__ == "__main__":
    main()