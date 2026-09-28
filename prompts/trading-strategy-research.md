# Trading Strategy Research Prompt (refined)

Copy everything inside the `<prompt>` block. Before you send it, change the values in `<inputs>`. The defaults are set for US equities.

```xml
<prompt>

<inputs>
  MARKET:            US equities (S&P 500 constituents + the 11 SPDR sector ETFs)
  BENCHMARK:         SPY total return; the relevant sector ETF for sector strategies
  DATA_START:        2005-01-01   (must include 2008, 2020 and 2022)
  IN_SAMPLE:         2005-01-01 to 2017-12-31
  OUT_OF_SAMPLE:     2018-01-01 to latest available close   (do not look at it until design is frozen)
  CAPITAL:           $1,000,000
  MAX_STRATEGIES:    10   (fewer is fine, and so is zero, if nothing passes)
  HOLDING_HORIZON:   days to months (no intraday)
</inputs>

<role>
You are a skeptical quantitative research analyst. Your job is to find out whether an edge exists,
not to produce one. A well-supported "nothing here survives costs" is a valid and useful result.
</role>

<objective>
Research, implement, backtest and critically evaluate up to MAX_STRATEGIES fundamentally different
trading strategies for MARKET. Deliver a ranked shortlist backed by code and reproducible results,
together with an honest account of what failed.
</objective>

<environment_check>
Before any research, state exactly which of these you can actually use in this session:
market data (source, frequency, date range), fundamentals, code execution, web search.
- If you cannot execute code, deliver the code and the method only. Report NO performance numbers.
- If your data has known flaws (e.g. current-constituent lists that cause survivorship bias,
  unadjusted prices, missing delistings), name them and explain how they bias the results.
</environment_check>

<process>
1. Market context: current regime (trend, volatility, rates, breadth, sector leadership), cited
   to dated sources. Label facts, interpretation and assumptions separately.
2. Hypotheses: propose candidate strategies drawn from distinct families (e.g. momentum,
   mean reversion, value/quality, carry/defensive, event-driven, pairs). For each, give the
   economic reason the edge should exist and who is on the other side of the trade.
3. Pre-registration: before running anything, write down for each strategy its universe, signal,
   entry and exit, sizing, rebalance frequency, parameters, and the result that would falsify it.
4. Implementation: clean, commented, runnable code using only information available at the
   decision time (signals on close t, trades at open t+1 or later).
5. In-sample backtest: IN_SAMPLE period only. Log every variant and parameter set you try.
6. Robustness: parameter sensitivity (±25–50%), walk-forward, sub-period and regime splits,
   2× cost stress, removal of the best 5 trades / best year.
7. Out-of-sample: run the frozen designs once on OUT_OF_SAMPLE. Do not tune afterwards.
   If you do change anything, say so explicitly, because the result is then no longer out of sample.
8. Selection and report, as specified in <output_format>.
</process>

<backtest_assumptions>
- Costs: at least 5 bps commission + 5 bps slippage per side for large caps, and more for
  small or illiquid names. State what you used.
- Liquidity: trade at most 5% of 20-day average dollar volume per name.
- Shorting: include borrow cost (≥ 50 bps/yr for general collateral) or run long-only.
- Use split- and dividend-adjusted prices, and include delisted names where the data allows.
- Cash earns the T-bill rate. Sharpe and Sortino are computed on excess returns.
</backtest_assumptions>

<metrics>
For each strategy, over the in-sample, out-of-sample and full periods: total return, CAGR, annualised volatility, Sharpe,
Sortino, max drawdown and its duration, Calmar, win rate, profit factor, number of trades,
turnover, average holding period, beta and correlation to BENCHMARK, and alpha t-stat.
Also report the number of variants tried and a multiple-testing-adjusted Sharpe
(e.g. deflated Sharpe ratio).
</metrics>

<acceptance_criteria>
A strategy makes the shortlist only if all of the following hold:
- Its out-of-sample Sharpe after costs is > 0.5 and at least half its in-sample Sharpe.
- It beats BENCHMARK on a risk-adjusted basis out of sample, or adds diversification
  (correlation < 0.5) at acceptable return.
- Max drawdown is < 30% and it has at least 100 trades (or 30 rebalances for slow strategies).
- It stays profitable across the ±25% parameter range and at 2× costs.
- It has a plausible, stated economic rationale.
- It can be implemented at CAPITAL under the liquidity constraint.
Report any strategy that fails, and say which criterion it failed.
</acceptance_criteria>

<output_format>
1. Executive summary: the verdict first, and how many strategies passed out of how many tested.
2. Environment and data: sources, date ranges, known biases.
3. Market context: regime, narratives and opportunities, each with dated citations.
4. Strategy cards: thesis, rules, parameters, falsification test, code.
5. Results table: every strategy tested, with the metrics above, split in-sample / out-of-sample.
6. Charts: equity curve against the benchmark, drawdown, rolling 12-month Sharpe, and parameter heatmap.
7. Ranking: the shortlist ordered by out-of-sample risk-adjusted return, with pros and cons.
8. Portfolio view: correlations between the shortlisted strategies, and a combined allocation if sensible.
9. Deployment: position sizing, risk limits, rebalance schedule, monitoring, and a kill switch
   (e.g. stop if the live drawdown exceeds 1.5× the backtest maximum).
10. What could go wrong: key risks, invalidation conditions, and what would change your mind.
</output_format>

<rules>
- Never state a performance number that was not produced by code you ran in this session.
- Never use out-of-sample data to design, select or tune.
- Prefer fewer honest results to many fragile ones. Do not pad to hit MAX_STRATEGIES.
- Label every claim as fact (with source and date), interpretation, or assumption.
- Social media sentiment can be used as a tested signal, but never as evidence on its own.
- This is research, not investment advice. Say so in the summary.
</rules>

<final_check>
Before finishing, answer each question briefly in the report:
- Did I leak any future information (look-ahead, survivorship, restated fundamentals)?
- How many things did I try, and does the adjusted Sharpe still hold up?
- Does the edge survive 2× costs and the worst regime in the sample?
- Is the out-of-sample result consistent with the in-sample result, or did it just get lucky?
- What evidence would invalidate each thesis, and how will I monitor for it live?
</final_check>

</prompt>
```

---

## What changed from the original, and why

| Issue in the original | Fix |
|---|---|
| The market was only an example ("e.g. US equities… RELIANCE"). | An `<inputs>` block with explicit, editable values, defaulting to US equities. |
| It told the model it *has* real-time data and a backtester, which invites made-up results when it doesn't. | `<environment_check>` makes it declare which tools it actually has, and a rule bans any number it didn't compute. |
| `<risk_management>` appeared twice, and `<research_process>`, `<detailed_steps>` and `<tools_and_data>` overlapped. | These are merged into a single `<process>`. |
| "Realistic costs" and "out-of-sample" were never defined. | Concrete costs, liquidity, borrow and date splits in `<backtest_assumptions>` and `<inputs>`. |
| Nothing guarded against data snooping across many variants. | Pre-registration, a log of every variant, a deflated Sharpe, and a single out-of-sample run. |
| "Sharpe > 1.0 preferred" was vague, and the prompt asked for 3–10 winners. | Measurable pass/fail criteria, with zero winners explicitly allowed. |
| Survivorship and look-ahead bias were not mentioned. | Called out in the data check, the process, and the final check. |
| Typos ("andhistorical", "Identifn"). | Fixed. |
