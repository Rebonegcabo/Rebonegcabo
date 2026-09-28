# Pre-registration — US index-timing study (run 1)

Written and committed **before** any backtest was run, so the git history shows the rules were
fixed in advance. Anything changed after results were seen is listed at the bottom under
"Deviations".

## Environment check (what this session can actually use)

| Need | Status |
|---|---|
| Daily US/JSE prices (Yahoo, Stooq), FRED, JSE, Ken French library | **Blocked** by the environment's network policy |
| Code execution | Yes (Python 3.11, pandas, numpy, scipy) |
| Web search for market context | Not used; no dated sources are available here to cite |
| Market data actually available | `datasets/s-and-p-500` on GitHub (Shiller data, commit `78cdceb`, 2026-09-01) |

Consequences:

- **South Africa: no data, so no results.** The SA pipeline is written, but it is not run.
- **US: index level only, monthly.** Single stocks and sector ETFs are out of scope, so this
  run tests *market-timing* strategies on the S&P 500 index against buy-and-hold.

## Known data flaws, and how they bias results

1. **Prices are monthly averages of daily closes**, not month-end prices. Averaging creates
   positive autocorrelation (≈0.25) between consecutive monthly returns. That makes trend and
   momentum look better than they are, and hides part of every drawdown.
   *Mitigation:* every signal uses information only up to month t-2 to trade month t (a skip month).
   The lag-1 version is reported only as a diagnostic, to show how large the inflation is.
2. **Dividends, earnings, CAPE, CPI and the 10-year yield stop at 2023-06/09.** After that there is
   only the price. *Assumption:* for total return after 2023-06, the dividend yield is held at
   its last value. The valuation strategies (S3, S4) are evaluated out of sample only to 2023-06.
3. **No T-bill rate.** *Assumption:* cash is tested at two bounds. The lower bound is 0% (which
   penalises timing strategies); the upper bound is the 10-year yield (which flatters them).
   After 2023-09 the yield is held at its last value. Sharpe is computed on returns in excess of
   the same cash rate.
4. The index is survivorship-free by construction, because it tracks the index itself, not
   today's constituents.

## Windows

- **In-sample (design):** 1881-01 to 2017-12. This deviates from the preset's start in 2005,
  because monthly timing rules switch too rarely to test over 13 years. The preset's own window
  (2005–2017) is reported as a sub-period.
- **Out-of-sample:** 2018-01 to 2026-08, run **once** on the frozen rules.

## Costs

Each switch pays 5 bps commission + 5 bps slippage per side, charged as 0.10% × |change in weight|.
The stress test doubles this. Portfolios are long-only with weights between 0 and 1, and no leverage.

## Strategies (base parameter first; the alternatives are for the sensitivity test only)

| ID | Family | Rule (signal known at end of month t-2, held during month t) | Base | Sensitivity |
|---|---|---|---|---|
| S1 | Trend | Hold 100% equity if price > N-month SMA, otherwise hold cash | N=10 | 5, 8, 12, 15 |
| S2 | Time-series momentum | 100% if N-month total return > N-month cash return, otherwise cash | N=12 | 6, 9, 15, 18 |
| S3 | Valuation (CAPE) | 100% if CAPE is below the q-th percentile of its expanding history (≥240 months), otherwise 50% | q=80 | 60, 70, 90 |
| S4 | Equity risk premium | 100% if 1/CAPE − 10y yield is above the q-th percentile of its expanding history, otherwise 50% | q=50 | 30, 40, 60, 70 |
| S5 | Seasonality | 100% from Nov to Apr, cash from May to Oct (calendar rule, no lag needed) | Nov–Apr | Oct–Mar, Dec–May |
| S6 | Volatility targeting | weight = min(1, target / trailing 12-month realised volatility) | 15% | 10, 12.5, 17.5, 20 |
| BH | Benchmark | 100% S&P 500 total return | – | – |

**Economic rationale:**
- S1/S2: slow diffusion of information and flows that chase performance.
- S3/S4: the valuation level predicts long-horizon returns.
- S5: a documented calendar anomaly, with a weak rationale; it is included as a skeptic's control.
- S6: volatility clusters, but returns do not rise in step with it.

Who is on the other side: buy-and-hold investors who accept drawdowns, or rebalancers.

## What would falsify each strategy

A strategy fails if its out-of-sample Sharpe (net of costs, lower-bound cash) is ≤ 0.5, or less
than half its in-sample Sharpe, or if it does not beat buy-and-hold's Sharpe out of sample.

## Acceptance criteria (from the prompt, adapted to monthly index timing)

1. Out-of-sample Sharpe > 0.5, and at least half of the in-sample Sharpe.
2. Out-of-sample Sharpe > buy-and-hold out-of-sample Sharpe, or correlation to buy-and-hold < 0.5.
3. Max drawdown < 30% from 2005 onward (the whole-history max drawdown is also shown, for context).
4. At least 30 switches in-sample.
5. In-sample Sharpe is positive at every sensitivity setting and at 2× costs.
6. Deflated Sharpe probability > 0.95 in-sample, correcting for every variant tried.

## Multiple testing

Every configuration run on in-sample data is counted: 6 strategies × all their settings, plus the
lag-1 diagnostics. The deflated Sharpe ratio (Bailey & López de Prado, 2014) uses that count.

## Deviations

These were logged after the first full run, including its out-of-sample section, had been seen.
They are **evaluation bug fixes**. No strategy rule, parameter, window or cost changed. The
headline result (0 of 6 pass) is the same before and after the fixes.

1. The in-sample windows started at the first data row (1871) instead of the pre-registered 1881-01. Fixed.
2. The deflated Sharpe pooled trials across both cash definitions, which inflated the variance
   of the trial Sharpes. It is now pooled within each cash definition (32 trials each).
3. Criterion 2 counted an exact tie with buy-and-hold as a "beat". This came from float noise:
   S3 held a constant 50% weight out of sample, so its Sharpe equals buy-and-hold's. The
   comparison is now made at 2 decimal places.
4. For S3/S4, the sub-period buy-and-hold Sharpe was measured over a longer window than the
   strategy's. Both are now measured on the same months.
5. Information ratio against buy-and-hold was added as an extra column. It is not a criterion.
6. S3/S4 out-of-sample ends 2023-06, as pre-registered.
