# Trading Strategy Research — Run 1 (US index timing)

*Prepared 2026-09-28 using `prompts/trading-strategy-research.md`, with ACTIVE_MARKET = BOTH.
This is research, not investment advice.*

## 1. Executive summary

**Verdict: none of the 6 strategies tested passes. South Africa could not be tested at all.**

- **South Africa: no results.** No JSE price data was reachable from this environment: Yahoo,
  JSE and Sharenet are blocked by its network policy. The SA pipeline is written (it converts
  prices quoted in cents, charges Securities Transfer Tax on purchases only, and has a test),
  but it has **not** been run. No SA numbers are reported.
- **US: tested at index level only.** The only market data available was the monthly S&P 500
  history (Shiller). So this run tests six *market-timing* rules against buy-and-hold, from 1881
  to August 2026. Single stocks and sector ETFs were not tested.
- **The best in-sample strategy was trend (S1): price above its 10-month average.**
  - Its Sharpe was 0.82, against 0.68 for buy-and-hold.
  - Its beta-adjusted alpha was 3.5% a year (t = 5.8).
  - It cut the worst drawdown from −82% to −52%.
  - It beat buy-and-hold in 3 of 4 sub-periods, held up under the 2× cost test and parameter
    changes, and walk-forward re-selection did slightly better still.
- **But out of sample (2018 to August 2026) it lagged:** Sharpe 1.01 against 1.14 for
  buy-and-hold, and CAGR 11.2% against 14.9%. Its drawdown was no smaller (−18.9% against
  −19.3%), because the COVID crash in 2020 and the 2022 decline moved faster than a signal
  lagged two months on monthly averages can react.
- **The nearest miss was S4, the equity risk premium rule.** Its out-of-sample Sharpe was 1.07
  against 0.83 for buy-and-hold (2018 to 2023-06). It still fails, for two reasons: its drawdown
  since 2005 is −33%, and it switched only 28 times in-sample, too few to trust.
- **A data artefact is visible in the diagnostic.** Trading one month after the signal instead
  of two raises S1's Sharpe from 0.82 to 0.97. That jump comes from the monthly price averaging,
  not from a real edge. Any backtest on this dataset that does not skip a month is flattering itself.

**Bottom line.** Over 140 years, simple trend-following on the S&P 500 lowered risk more than it
lowered return. It did not add return, and it did not help in the most recent 8½ years. None of
these rules justifies replacing buy-and-hold.

## 2. Environment and data

| Item | Status |
|---|---|
| Data used | `datasets/s-and-p-500` (Shiller, extended with FRED prices), commit `78cdceb` of 2026-09-01, covering 1871-01 to 2026-08 |
| Blocked by network policy | Yahoo Finance, Stooq, FRED, JSE, Sharenet, Ken French library, Hugging Face |
| Code | `research/engine.py`, `data.py`, `run_us_index.py`; tests in `test_engine.py` (11 pass) |
| Pre-registration | `research/PREREGISTRATION.md`, committed before any backtest (`8da4bf7`); deviations are logged there |

**Known biases, and which way they push the results:**

1. **Prices are monthly averages.** This inflates trend and momentum results and understates
   drawdowns. Every signal is therefore lagged two months, and the lag-1 results are shown
   only as a diagnostic.
2. **There is no T-bill series.** Cash is modelled at two bounds: 0% (pessimistic for timing
   rules) and the 10-year yield (optimistic). The conclusions hold under both.
3. **Dividends, CAPE and yields stop in mid-2023.** After that, the dividend yield is held at
   its last value, and the valuation rules (S3/S4) are tested only to 2023-06.
4. **The alpha t-statistics use plain OLS.** Monthly averaging creates autocorrelation, so the
   t-statistics are overstated. Treat them as upper bounds.

## 3. Market context (from web search summaries, not independently verified)

- **US:** On 2026-09-17 the S&P 500 was at about 7,637, around 2% below its record. The 10-year
  Treasury yielded 4.94% and the fed funds target range was 3.75–4.00%
  ([Goldman Sachs AM, Market Pulse, Sep 2026](https://am.gs.com/en-us/advisors/insights/article/market-pulse)).
  The forward P/E is about 23× ([Forbes, Sep 2026](https://www.forbes.com/sites/investor-hub/article/what-to-expect-for-the-stock-markets-last-6-months-of-2026/)).
  *Interpretation:* these are rich valuations, which is exactly the setting where S3/S4 would
  hold 50% equity. But those rules failed their tests, so this is not a trading signal.
- **SA:** On 2026-09-23 the SARB raised the repo rate by 25 bps to 7.25%, after August CPI came in
  at 4.4% ([Moneyweb](https://www.moneyweb.co.za/news/economy/sarb-ups-repo-rate-to-7-25/)).
  In late September the All Share was around 113,349 and the Top 40 around 105,618, with
  Industrials leading and Resources lagging
  ([Sanlam Private Wealth daily report, 23 Sep 2026](https://sanlamprivatewealth.sanlam.com/documents/3615/23_September_2026_Daily_Market_Report.pdf)).

## 4. Strategy cards

The exact rules, their rationale and how each could be falsified are in `PREREGISTRATION.md`.
In short: signals are known at the end of month t-2 and held during month t; weights are long-only
between 0 and 1; each switch costs 0.10% per side.

| ID | Rule (base parameter) |
|---|---|
| S1 | 100% equity if price > 10-month SMA, otherwise cash |
| S2 | 100% if 12-month total return > cash return, otherwise cash |
| S3 | 100% if CAPE is below the 80th percentile of its own history so far, otherwise 50% |
| S4 | 100% if 1/CAPE − 10y yield is above its historical median so far, otherwise 50% |
| S5 | 100% from Nov to Apr, cash from May to Oct |
| S6 | weight = min(1, 15% ÷ trailing 12-month volatility) |

## 5. Results (cash = 0%, the lower bound; the upper-bound tables are in `results/tables.md`)

**In-sample, 1881–2017** (S3/S4 start in 1901, because they need 20 years of CAPE history first)

| Strategy | CAGR | Vol | Sharpe | Max DD | Switches | Alpha/yr (t) |
|---|---|---|---|---|---|---|
| Buy & hold | 9.1% | 14.3% | 0.68 | −81.8% | 0 | – |
| S1 Trend | 7.4% | 9.3% | **0.82** | −51.5% | 186 | 3.5% (5.8) |
| S2 TS momentum | 7.3% | 10.1% | 0.75 | −48.8% | 110 | 2.8% (4.5) |
| S3 CAPE | 8.6% | 13.2% | 0.69 | −75.2% | 38 | 0.2% (0.6) |
| S4 ERP | 7.5% | 12.0% | 0.66 | −72.1% | 28 | 0.0% (0.0) |
| S5 Seasonal | 5.2% | 9.1% | 0.61 | −55.5% | 274 | 1.6% (2.7) |
| S6 Vol target | 8.8% | 12.3% | 0.75 | −67.0% | 324 | 1.2% (4.0) |

**Out-of-sample, 2018-01 to 2026-08** (S3/S4 to 2023-06; each is compared with buy-and-hold over the same months)

| Strategy | CAGR | Sharpe | Buy & hold Sharpe | Max DD | Switches |
|---|---|---|---|---|---|
| Buy & hold | 14.9% | 1.14 | – | −19.3% | 0 |
| S1 Trend | 11.2% | 1.01 | 1.14 | −18.9% | 8 |
| S2 TS momentum | 10.7% | 0.92 | 1.14 | −18.9% | 6 |
| S3 CAPE | 5.7% | 0.83 | 0.83 | −9.9% | 0 (held 50% throughout) |
| S4 ERP | 8.9% | **1.07** | 0.83 | −9.9% | 2 |
| S5 Seasonal | 5.1% | 0.54 | 1.14 | −18.9% | 17 |
| S6 Vol target | 13.0% | 1.04 | 1.14 | −19.3% | 17 |

**Acceptance** (the same result under both cash bounds)

| Strategy | What it failed |
|---|---|
| S1 Trend | Did not beat buy-and-hold out of sample |
| S2 TS momentum | Did not beat buy-and-hold out of sample |
| S3 CAPE | Did not beat buy-and-hold out of sample (a tie); drawdown since 2005 of −36% |
| S4 ERP | Drawdown since 2005 of −33%; only 28 switches in-sample |
| S5 Seasonal | Did not beat buy-and-hold; out-of-sample Sharpe under 0.5 at upper-bound cash |
| S6 Vol target | Did not beat buy-and-hold out of sample; drawdown since 2005 of −46% |

## 6. Charts

Not produced yet. See the question at the end of this report.

## 7. Ranking

Nothing passed, so there is no shortlist. Ranked by how close each came:

1. **S1 Trend.** The strongest long-run evidence, and robust in every in-sample test. It failed only on the recent out-of-sample period.
2. **S4 ERP.** It won out of sample, but over a short 5½-year window with only 2 switches, so there is too little evidence to trust it.
3. **S2 TS momentum.** Similar to S1, but slightly weaker throughout.
4. **S6 Vol target.** Its in-sample alpha is real but small. It did not protect in 2008 (drawdown −46% since 2005).
5. **S3 CAPE.** It spent the whole out-of-sample period at 50% weight, so its result is just buy-and-hold at half size.
6. **S5 Seasonal.** It lagged buy-and-hold in-sample. This was the expected result for the control strategy.

## 8. Portfolio view

Not applicable, since there is no shortlist. For reference, S1 and S2 have a correlation of 0.84 in-sample, because both are trend rules.

## 9. Deployment

Nothing is recommended for deployment. If you still want S1 as a *risk overlay* (to cut drawdowns
rather than add return), size it for the drawdown you can tolerate. Expect it to lag in fast
V-shaped markets. A sensible kill switch: stop if the live shortfall against buy-and-hold ever
exceeds 1.5× the worst backtested 3-year shortfall.

## 10. What could go wrong, and what would change my mind

- The monthly-average data understates drawdowns, even with the lag. Daily month-end data could
  make every rule look better or worse.
- Only index timing was testable. The strategy families most likely to show an edge (cross-sectional
  momentum, quality/value across stocks, sector rotation) need daily constituent-level data.
- **To get a real answer for both markets,** allow `query1.finance.yahoo.com`,
  `query2.finance.yahoo.com` and `fred.stlouisfed.org` in this environment's network settings,
  then run 2 can use the daily loaders in `data.py`. For proper point-in-time JSE constituents and
  delistings, you would need a paid source (e.g. IRESS or Bloomberg).

## Final check

- **Look-ahead:** each signal is lagged 2 months and valuation percentiles use only past data;
  tests check both on synthetic data.
- **How many trials:** 32 per cash definition. The deflated Sharpe stays above 0.95, but it tests
  against zero, not against buy-and-hold, so it is not the binding test here.
- **2× costs and the worst regime:** in-sample Sharpe barely moves at 2× costs; 1881–1945 includes 1929–32.
- **Is out of sample consistent with in sample?** No, for S1/S2: the edge they showed over 140
  years did not appear in 2018–2026. That fits the view that trend works on slow bear markets,
  not fast crashes.
