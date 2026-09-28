"""Run 1: pre-registered US index-timing study on the Shiller S&P 500 monthly data.

    python research/run_us_index.py

Writes research/results/*.csv and research/results/tables.md. The rules and parameters are
fixed in research/PREREGISTRATION.md; do not change them here without logging a deviation.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

import engine
from data import load_shiller, us_cost_per_side

OUT = Path(__file__).parent / "results"
IS_START = "1881-01-01"
IS_END = "2017-12-31"
OOS_START = "2018-01-01"
VALUATION_END = "2023-06-30"   # dividends / CAPE / yields stop here in the source
LAG = 2                        # skip month: signal known end of t-2, held in t
COST = us_cost_per_side()
SUBPERIODS = [("1881", "1945"), ("1946", "1989"), ("1990", "2004"), ("2005", "2017")]


# ------------------------------------------------------------------------------ signals
# Each returns the *raw* weight known at the end of month t. The runner applies the lag.

def s1_trend(d, cash, n):
    return (d["price"] > d["price"].rolling(n).mean()).astype(float).where(
        d["price"].rolling(n).mean().notna())


def s2_tsmom(d, cash, n):
    r = (1 + d["ret"]).rolling(n).apply(np.prod, raw=True) - 1
    c = (1 + cash).rolling(n).apply(np.prod, raw=True) - 1
    return (r > c).astype(float).where(r.notna())


def _expanding_pct(x: pd.Series, min_periods: int = 240) -> pd.Series:
    return x.expanding(min_periods=min_periods).rank(pct=True)


def s3_cape(d, cash, q):
    pct = _expanding_pct(d["cape"].dropna()).reindex(d.index)
    return pd.Series(np.where(pct < q / 100, 1.0, 0.5), index=d.index).where(pct.notna())


def s4_erp(d, cash, q):
    erp = (1 / d["cape"] - d["y10"]).where(d["cape"].notna())
    pct = _expanding_pct(erp.dropna()).reindex(d.index)
    return pd.Series(np.where(pct > q / 100, 1.0, 0.5), index=d.index).where(pct.notna())


def s5_season(d, cash, start_month):
    months = [(start_month - 1 + k) % 12 + 1 for k in range(6)]
    return pd.Series(d.index.month.isin(months).astype(float), index=d.index)


def s6_voltarget(d, cash, target):
    vol = d["ret"].rolling(12).std() * np.sqrt(12)
    return (target / 100 / vol).clip(upper=1.0)


STRATS = {
    "S1 Trend (SMA)":        (s1_trend,     10, [5, 8, 12, 15], "months"),
    "S2 TS momentum":        (s2_tsmom,     12, [6, 9, 15, 18], "months"),
    "S3 CAPE valuation":     (s3_cape,      80, [60, 70, 90],   "pctile"),
    "S4 Equity risk premium": (s4_erp,      50, [30, 40, 60, 70], "pctile"),
    "S5 Seasonal (Nov-Apr)": (s5_season,    11, [10, 12],       "start month"),
    "S6 Vol target":         (s6_voltarget, 15, [10, 12.5, 17.5, 20], "% vol"),
}
CALENDAR = {"S5 Seasonal (Nov-Apr)"}      # calendar rules need no information lag
VALUATION = {"S3 CAPE valuation", "S4 Equity risk premium"}


def weights(name, d, cash, param, lag=LAG):
    fn = STRATS[name][0]
    raw = fn(d, cash, param)
    w = raw if name in CALENDAR else raw.shift(lag)
    if name in VALUATION:
        w = w[w.index <= VALUATION_END]
    return w


def backtest(name, d, cash_col, param, lag=LAG, cost=COST):
    cash = d[cash_col]
    w = weights(name, d, cash, param, lag)
    return engine.run(w, d["ret"], cash, cost)


def bh(d, cash_col):
    return engine.run(pd.Series(1.0, index=d.index), d["ret"], d[cash_col], COST)


def window(df, start=None, end=None):
    return df.loc[start:end]


def m(res, bench, start=None, end=None):
    r = window(res, start, end)
    b = bench["net"].reindex(r.index)
    return engine.metrics(r["net"], r["cash"], bench=b, w=r["w"])


# ------------------------------------------------------------------------------ study

def main():
    OUT.mkdir(exist_ok=True)
    d = load_shiller()
    first = d["ret"].first_valid_index()
    d = d.loc[first:]

    trials = []            # every configuration run on in-sample data: (label, per-month SR)
    is_rows, rob_rows, wf_rows, oos_rows = [], [], [], []

    for cash_col in ("cash_lo", "cash_hi"):
        bench = bh(d, cash_col)
        bm_is = m(bench, bench, IS_START, IS_END)
        is_rows.append({"strategy": "BH Buy & hold", "cash": cash_col, **bm_is})

        for name, (fn, base, alts, unit) in STRATS.items():
            # --- in-sample, base
            res = backtest(name, d, cash_col, base)
            mi = m(res, bench, IS_START, IS_END)
            is_rows.append({"strategy": name, "cash": cash_col, **mi})
            ex = window(res, IS_START, IS_END)
            ex = ex["net"] - ex["cash"]
            trials.append((cash_col, f"{name}|{base}|{cash_col}", ex.mean() / ex.std(), len(ex),
                           mi["skew"], mi["kurt"]))

            # --- sensitivity (each is a trial)
            sens = {}
            for p in alts:
                rp = backtest(name, d, cash_col, p)
                mp = m(rp, bench, IS_START, IS_END)
                sens[p] = mp["sharpe"]
                exp = window(rp, IS_START, IS_END)
                exp = exp["net"] - exp["cash"]
                trials.append((cash_col, f"{name}|{p}|{cash_col}", exp.mean() / exp.std(), len(exp),
                               mp["skew"], mp["kurt"]))

            # --- lag-1 diagnostic (shows the monthly-averaging inflation; counted as a trial)
            lag1 = np.nan
            if name not in CALENDAR:
                r1 = backtest(name, d, cash_col, base, lag=1)
                m1 = m(r1, bench, IS_START, IS_END)
                lag1 = m1["sharpe"]
                ex1 = window(r1, IS_START, IS_END)
                ex1 = ex1["net"] - ex1["cash"]
                trials.append((cash_col, f"{name}|{base}|lag1|{cash_col}", ex1.mean() / ex1.std(),
                               len(ex1), m1["skew"], m1["kurt"]))

            # --- 2x costs
            r2 = backtest(name, d, cash_col, base, cost=2 * COST)
            sh2 = m(r2, bench, IS_START, IS_END)["sharpe"]

            # --- drop best calendar year
            isr = window(res, IS_START, IS_END)
            yr = (1 + isr["net"]).groupby(isr.index.year).prod()
            best = yr.idxmax()
            keep = isr[isr.index.year != best]
            sh_drop = engine.metrics(keep["net"], keep["cash"])["sharpe"]

            # --- sub-periods: strategy minus buy & hold Sharpe
            subs = {}
            for a, b in SUBPERIODS:
                ra = window(res, a, b)
                sa = engine.metrics(ra["net"], ra["cash"])["sharpe"]
                rb_ = bench.reindex(ra.index)
                sb = engine.metrics(rb_["net"], rb_["cash"])["sharpe"]
                subs[f"{a}-{b}"] = sa - sb

            rob_rows.append({"strategy": name, "cash": cash_col, "base": base, "unit": unit,
                             "is_sharpe": mi["sharpe"], "bh_is_sharpe": bm_is["sharpe"],
                             **{f"sens_{p}": v for p, v in sens.items()},
                             "min_sens_sharpe": min(list(sens.values()) + [mi["sharpe"]]),
                             "lag1_sharpe": lag1, "cost2x_sharpe": sh2,
                             "drop_best_year": int(best), "drop_best_sharpe": sh_drop,
                             **{f"vsBH_{k}": v for k, v in subs.items()}})

            # --- walk-forward parameter choice: re-pick best variant each decade on prior data
            params = [base] + alts
            runs = {p: backtest(name, d, cash_col, p) for p in params}
            chained = []
            for dec in range(1931, 2018, 10):
                hist_end = f"{dec - 1}-12-31"
                scores = {p: m(runs[p], bench, IS_START, hist_end)["sharpe"] for p in params}
                pick = max(scores, key=lambda k: -np.inf if np.isnan(scores[k]) else scores[k])
                seg = window(runs[pick], f"{dec}-01-01", min(f"{dec + 9}-12-31", IS_END))
                chained.append(seg)
            wf = pd.concat(chained)
            wf_rows.append({"strategy": name, "cash": cash_col,
                            "wf_sharpe_1931_2017": engine.metrics(wf["net"], wf["cash"])["sharpe"],
                            "base_sharpe_1931_2017": m(res, bench, "1931", IS_END)["sharpe"],
                            "bh_sharpe_1931_2017": m(bench, bench, "1931", IS_END)["sharpe"]})

    # ---------------------------------------------------------- deflated Sharpe (in-sample)
    # trials are pooled within each cash definition only (mixing them inflates V[SR])
    dsr = {}
    for cash_col in ("cash_lo", "cash_hi"):
        group = [t for t in trials if t[0] == cash_col]
        sr_all = np.array([t[2] for t in group])
        for _, label, sr, T, sk, ku in group:
            dsr[label] = engine.deflated_sharpe(sr, sr_all, T, sk, ku)
    n_trials = len(trials) // 2

    # ---------------------------------------------------------- out-of-sample: run ONCE
    for cash_col in ("cash_lo", "cash_hi"):
        bench = bh(d, cash_col)
        oos_rows.append({"strategy": "BH Buy & hold", "cash": cash_col,
                         **m(bench, bench, OOS_START)})
        for name, (fn, base, alts, unit) in STRATS.items():
            res = backtest(name, d, cash_col, base)
            mo = m(res, bench, OOS_START)
            r = window(res, OOS_START)
            mo["bh_sharpe_same_window"] = m(bench, bench, r.index[0], r.index[-1])["sharpe"]
            mo["oos_end"] = str(r.index[-1].date())
            mo["dd_since_2005"] = engine.max_drawdown(window(res, "2005")["net"])[0]
            mo["dd_full"] = engine.max_drawdown(res["net"])[0]
            oos_rows.append({"strategy": name, "cash": cash_col, **mo})

    is_df = pd.DataFrame(is_rows)
    rob_df = pd.DataFrame(rob_rows)
    wf_df = pd.DataFrame(wf_rows)
    oos_df = pd.DataFrame(oos_rows)
    is_df["dsr"] = [dsr.get(f"{s}|{STRATS[s][1]}|{c}", np.nan) if s in STRATS else np.nan
                    for s, c in zip(is_df["strategy"], is_df["cash"])]

    # ---------------------------------------------------------- acceptance (lower-bound cash)
    acc = []
    for name in STRATS:
        for cash_col in ("cash_lo", "cash_hi"):
            i = is_df[(is_df.strategy == name) & (is_df.cash == cash_col)].iloc[0]
            o = oos_df[(oos_df.strategy == name) & (oos_df.cash == cash_col)].iloc[0]
            rb = rob_df[(rob_df.strategy == name) & (rob_df.cash == cash_col)].iloc[0]
            c = {
                "1 OOS SR>0.5 & >=half IS": o.sharpe > 0.5 and o.sharpe >= 0.5 * i.sharpe,
                "2 beats BH OOS or corr<0.5": (round(o.sharpe, 2) > round(o.bh_sharpe_same_window, 2)
                                               or o.corr_bh < 0.5),
                "3 MaxDD since 2005 <30%": o.dd_since_2005 > -0.30,
                "4 >=30 switches IS": i.switches >= 30,
                "5 robust (sens & 2x cost SR>0)": rb.min_sens_sharpe > 0 and rb.cost2x_sharpe > 0,
                "6 DSR>0.95": i.dsr > 0.95,
            }
            acc.append({"strategy": name, "cash": cash_col, **c, "PASS": all(c.values())})
    acc_df = pd.DataFrame(acc)

    for nm, df in [("in_sample", is_df), ("robustness", rob_df), ("walk_forward", wf_df),
                   ("out_of_sample", oos_df), ("acceptance", acc_df)]:
        df.to_csv(OUT / f"{nm}.csv", index=False)
    write_tables(is_df, rob_df, wf_df, oos_df, acc_df, n_trials, d)
    print(f"trials counted per cash definition: {n_trials}")


def _fmt(df, cols, pct=(), dp=2):
    t = df[cols].copy()
    for c in cols:
        if c in pct:
            t[c] = t[c].map(lambda v: f"{v:.1%}" if pd.notna(v) else "–")
        elif t[c].dtype.kind == "f":
            t[c] = t[c].map(lambda v: f"{v:.{dp}f}" if pd.notna(v) else "–")
        elif t[c].dtype.kind == "b":
            t[c] = t[c].map(lambda v: "pass" if v else "**fail**")
    return t.to_markdown(index=False)


def write_tables(is_df, rob_df, wf_df, oos_df, acc_df, n_trials, d):
    pct = ("total_return", "cagr", "vol", "max_dd", "win_rate", "alpha_ann", "avg_weight",
           "dd_since_2005", "dd_full")
    lines = [f"Data: {d.index[0].date()} to {d.index[-1].date()}. Trials counted for DSR: {n_trials} per cash definition.\n"]
    for cash_col, label in (("cash_lo", "cash = 0% (lower bound)"),
                            ("cash_hi", "cash = 10y yield (upper bound)")):
        lines += [f"\n### In-sample 1881–2017, {label}\n",
                  _fmt(is_df[is_df.cash == cash_col],
                       ["strategy", "cagr", "vol", "sharpe", "sortino", "max_dd", "calmar",
                        "switches", "avg_weight", "corr_bh", "alpha_ann", "alpha_t", "ir_vs_bh", "dsr"], pct),
                  f"\n### Out-of-sample 2018 onward, {label}\n",
                  _fmt(oos_df[oos_df.cash == cash_col],
                       ["strategy", "oos_end", "total_return", "cagr", "vol", "sharpe",
                        "bh_sharpe_same_window", "max_dd", "switches", "corr_bh", "alpha_ann",
                        "alpha_t", "ir_vs_bh", "dd_since_2005"], pct),
                  f"\n### Robustness (in-sample), {label}\n",
                  _fmt(rob_df[rob_df.cash == cash_col].drop(columns="cash"),
                       [c for c in rob_df.columns if c != "cash"]),
                  f"\n### Walk-forward parameter choice, {label}\n",
                  _fmt(wf_df[wf_df.cash == cash_col],
                       ["strategy", "wf_sharpe_1931_2017", "base_sharpe_1931_2017",
                        "bh_sharpe_1931_2017"]),
                  f"\n### Acceptance, {label}\n",
                  _fmt(acc_df[acc_df.cash == cash_col].drop(columns="cash"),
                       [c for c in acc_df.columns if c != "cash"])]
    (OUT / "tables.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
