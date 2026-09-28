"""Data loaders.

``load_shiller``  - the S&P 500 monthly dataset (datasets/s-and-p-500 on GitHub). Used in run 1.
``load_yahoo``    - daily prices for US or JSE tickers via yfinance. NOT run in this session:
                    the environment's network policy blocks Yahoo. It is kept here so that the
                    same study can be re-run once *.finance.yahoo.com is allowed.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

SHILLER_CSV = Path("/home/user/datasets/s-and-p-500/data/data.csv")


def load_shiller(path: Path = SHILLER_CSV) -> pd.DataFrame:
    """Monthly frame with: price, div, ret (total return), cape, y10, cash_lo, cash_hi.

    Columns that the source zero-fills after 2023 are set to NaN, then handled explicitly:
    - dividend yield is carried forward from its last observation (flagged in ``div_filled``)
    - the 10-year yield is carried forward (flagged in ``y10_filled``)
    - CAPE is left NaN; valuation strategies stop where CAPE stops
    """
    d = pd.read_csv(path, parse_dates=["Date"]).set_index("Date").sort_index()
    d = d.replace(0.0, np.nan)
    out = pd.DataFrame(index=d.index)
    out["price"] = d["SP500"]
    dy = d["Dividend"] / d["SP500"]
    out["div_filled"] = dy.isna() & (d.index > dy.last_valid_index())
    out["div"] = dy.ffill() * d["SP500"]
    out["ret"] = (out["price"] + out["div"] / 12) / out["price"].shift(1) - 1
    out["cape"] = d["PE10"]
    out["y10"] = d["Long Interest Rate"] / 100
    out["y10_filled"] = out["y10"].isna() & (d.index > out["y10"].last_valid_index())
    out["y10"] = out["y10"].ffill()
    out["cash_lo"] = 0.0
    out["cash_hi"] = out["y10"] / 12
    return out


# --------------------------------------------------------------------------------------------
# Daily data for the full US / SA study (requires network access to Yahoo Finance).
# --------------------------------------------------------------------------------------------

def load_yahoo(tickers: list[str], start: str, market: str) -> pd.DataFrame:
    """Adjusted daily closes. For market == "SA", converts prices quoted in cents (ZAc) to rand.

    Yahoo quotes most .JO equities in cents but some ETFs in rand, so it checks each ticker's
    reported currency rather than assuming.
    """
    import yfinance as yf  # imported lazily so the offline run does not need network

    px = yf.download(tickers, start=start, auto_adjust=True, progress=False)["Close"]
    if isinstance(px, pd.Series):
        px = px.to_frame(tickers[0])
    if market == "SA":
        for t in px.columns:
            ccy = (yf.Ticker(t).fast_info.get("currency") or "").upper()
            if ccy in ("ZAC", "ZAX"):
                px[t] = px[t] / 100.0
    return px


def us_cost_per_side() -> float:
    """US preset: 5 bps commission + 5 bps slippage."""
    return 0.0005 + 0.0005


def sa_trade_cost(buy_value: float, sell_value: float, top40: bool = True) -> float:
    """SA preset, in rand, for one rebalance.

    Brokerage 15 bps + 15% VAT on it, 0.25% Securities Transfer Tax on purchases only,
    ~1 bp for JSE/STRATE levies, plus slippage (10 bps Top 40, 30 bps otherwise) per side.
    """
    brokerage = 0.0015 * 1.15
    levies = 0.0001
    slip = 0.0010 if top40 else 0.0030
    per_side = brokerage + levies + slip
    return per_side * (buy_value + sell_value) + 0.0025 * buy_value
