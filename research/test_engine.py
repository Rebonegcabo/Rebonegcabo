"""Sanity tests on synthetic data.  Run:  python -m pytest research -q"""
import numpy as np
import pandas as pd
import pytest

import engine
import run_us_index as R
from data import sa_trade_cost

IDX = pd.date_range("1900-01-01", periods=600, freq="MS")


def synth(seed=0):
    rng = np.random.default_rng(seed)
    ret = pd.Series(rng.normal(0.006, 0.04, len(IDX)), index=IDX)
    price = 100 * (1 + ret).cumprod()
    cape = pd.Series(15 + rng.normal(0, 3, len(IDX)).cumsum() * 0.1, index=IDX).abs() + 5
    return pd.DataFrame({"price": price, "div": 0.0, "ret": ret, "cape": cape,
                         "y10": 0.04, "cash_lo": 0.0, "cash_hi": 0.04 / 12})


def test_costs_charged_on_weight_change():
    ret = pd.Series([0.01, 0.01, 0.01, 0.01], index=IDX[:4])
    w = pd.Series([1.0, 0.0, 0.0, 1.0], index=IDX[:4])
    res = engine.run(w, ret, pd.Series(0.0, index=IDX[:4]), cost_per_side=0.001)
    assert res["net"].tolist() == pytest.approx([0.01 - 0.001, -0.001, 0.0, 0.01 - 0.001])


@pytest.mark.parametrize("name", list(R.STRATS))
def test_no_lookahead(name):
    """Changing month t's return must not change any weight at or before month t."""
    d = synth()
    base = R.weights(name, d, d["cash_lo"], R.STRATS[name][1])
    k = 400
    d2 = d.copy()
    d2.iloc[k, d2.columns.get_loc("ret")] = 0.5
    d2["price"] = 100 * (1 + d2["ret"]).cumprod()
    d2.iloc[k:, d2.columns.get_loc("cape")] *= 3
    moved = R.weights(name, d2, d2["cash_lo"], R.STRATS[name][1])
    upto = base.index[base.index <= IDX[k]]
    pd.testing.assert_series_equal(base.loc[upto], moved.loc[upto])


def test_skip_month_lag():
    """With LAG=2, a shock in month t first affects the weight in month t+2."""
    d = synth()
    k = 300
    d2 = d.copy()
    d2.iloc[k, d2.columns.get_loc("ret")] = -0.9
    d2["price"] = 100 * (1 + d2["ret"]).cumprod()
    a = R.weights("S1 Trend (SMA)", d, d["cash_lo"], 10)
    b = R.weights("S1 Trend (SMA)", d2, d2["cash_lo"], 10)
    assert a.iloc[k + 1] == b.iloc[k + 1]
    assert b.iloc[k + 2] == 0.0


def test_sa_stt_only_on_buys():
    buy_only = sa_trade_cost(1_000_000, 0)
    sell_only = sa_trade_cost(0, 1_000_000)
    assert buy_only - sell_only == pytest.approx(2_500)


def test_dsr_penalises_many_trials():
    rng = np.random.default_rng(1)
    few = rng.normal(0, 0.05, 2)
    many = rng.normal(0, 0.05, 200)
    assert engine.deflated_sharpe(0.1, many, 600, 0, 3) < engine.deflated_sharpe(0.1, few, 600, 0, 3)


def test_metrics_buy_and_hold_identity():
    d = synth()
    res = engine.run(pd.Series(1.0, index=IDX), d["ret"], d["cash_lo"], 0.0)
    mm = engine.metrics(res["net"], res["cash"], bench=res["net"], w=res["w"])
    assert mm["beta"] == pytest.approx(1.0)
    assert mm["corr_bh"] == pytest.approx(1.0)
