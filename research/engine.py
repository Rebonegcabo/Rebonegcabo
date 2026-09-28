"""Backtest engine: weights -> net returns, performance metrics, deflated Sharpe ratio.

Conventions
-----------
- All series are indexed by period end. ``weights[t]`` is the equity weight held *during*
  period t, and it must already be lagged by the caller so that it only uses information
  available before t starts.
- Cash earns ``cash[t]`` (per period, decimal) on the unused weight ``1 - w``.
- Costs are charged when the weight changes: ``cost_per_side * |w[t] - w[t-1]|``.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

EULER_GAMMA = 0.5772156649


def run(weights: pd.Series, asset_ret: pd.Series, cash: pd.Series,
        cost_per_side: float) -> pd.DataFrame:
    """Return a frame with gross and net strategy returns, turnover and the weight."""
    w = weights.reindex(asset_ret.index).astype(float)
    turnover = w.diff().abs()
    turnover.iloc[0] = abs(w.iloc[0]) if pd.notna(w.iloc[0]) else np.nan
    gross = w * asset_ret + (1 - w) * cash
    net = gross - cost_per_side * turnover
    return pd.DataFrame({"w": w, "gross": gross, "net": net, "turnover": turnover,
                         "cash": cash}).dropna()


def max_drawdown(r: pd.Series) -> tuple[float, int]:
    """Max drawdown (negative fraction) and its longest peak-to-recovery duration, in periods."""
    eq = (1 + r).cumprod()
    peak = eq.cummax()
    dd = eq / peak - 1
    underwater = (dd < 0).astype(int)
    longest = run_len = 0
    for u in underwater:
        run_len = run_len + 1 if u else 0
        longest = max(longest, run_len)
    return float(dd.min()), longest


def metrics(r: pd.Series, cash: pd.Series, ppy: int = 12,
            bench: pd.Series | None = None, w: pd.Series | None = None) -> dict:
    """Standard performance metrics. Sharpe/Sortino are on returns in excess of ``cash``."""
    r = r.dropna()
    c = cash.reindex(r.index)
    ex = r - c
    n = len(r)
    years = n / ppy
    total = float((1 + r).prod() - 1)
    cagr = float((1 + total) ** (1 / years) - 1) if years > 0 else np.nan
    vol = float(r.std() * np.sqrt(ppy))
    sharpe = float(ex.mean() / ex.std() * np.sqrt(ppy)) if ex.std() > 0 else np.nan
    downside = ex[ex < 0]
    dstd = np.sqrt((downside ** 2).sum() / n)
    sortino = float(ex.mean() / dstd * np.sqrt(ppy)) if dstd > 0 else np.nan
    mdd, mdd_len = max_drawdown(r)
    wins = r[r > c]
    gains = ex[ex > 0].sum()
    losses = -ex[ex < 0].sum()
    out = {
        "months": n, "total_return": total, "cagr": cagr, "vol": vol, "sharpe": sharpe,
        "sortino": sortino, "max_dd": mdd, "max_dd_months": mdd_len,
        "calmar": cagr / abs(mdd) if mdd < 0 else np.nan,
        "win_rate": len(wins) / n if n else np.nan,
        "profit_factor": float(gains / losses) if losses > 0 else np.nan,
        "skew": float(stats.skew(ex)), "kurt": float(stats.kurtosis(ex, fisher=False)),
    }
    if w is not None:
        wa = w.reindex(r.index)
        out["switches"] = int((wa.diff().abs() > 1e-9).sum())
        out["avg_weight"] = float(wa.mean())
        out["turnover_py"] = float(wa.diff().abs().sum() / years)
    if bench is not None:
        b = bench.reindex(r.index)
        bex = b - c
        out["corr_bh"] = float(r.corr(b))
        beta, alpha, _, _, _ = stats.linregress(bex, ex)
        resid = ex - (alpha + beta * bex)
        se_alpha = resid.std(ddof=2) / np.sqrt(n)
        out["beta"] = float(beta)
        out["alpha_ann"] = float(alpha * ppy)
        out["alpha_t"] = float(alpha / se_alpha) if se_alpha > 0 else np.nan
        active = r - b
        out["ir_vs_bh"] = (float(active.mean() / active.std() * np.sqrt(ppy))
                           if active.std() > 1e-12 else np.nan)
    return out


def deflated_sharpe(sr: float, sr_trials: np.ndarray, t: int, skew: float, kurt: float) -> float:
    """Probability that the true Sharpe is above what the best of N trials would reach by luck.

    ``sr`` and ``sr_trials`` are *per-period* (not annualised) Sharpe ratios. ``kurt`` is
    non-excess kurtosis. Bailey & Lopez de Prado (2014).
    """
    n = len(sr_trials)
    var = np.var(sr_trials, ddof=1) if n > 1 else 0.0
    if n < 2 or var <= 0:
        sr0 = 0.0
    else:
        sr0 = np.sqrt(var) * ((1 - EULER_GAMMA) * stats.norm.ppf(1 - 1 / n)
                              + EULER_GAMMA * stats.norm.ppf(1 - 1 / (n * np.e)))
    denom = np.sqrt(1 - skew * sr + (kurt - 1) / 4 * sr ** 2)
    return float(stats.norm.cdf((sr - sr0) * np.sqrt(t - 1) / denom))
