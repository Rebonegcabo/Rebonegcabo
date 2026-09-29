# research/

A trading-strategy study run from `prompts/trading-strategy-research.md`.

- `REPORT.md` — the findings (start here)
- `PREREGISTRATION.md` — the rules, fixed before any backtest, plus the deviations log
- `results/` — every table as CSV, plus `tables.md`
- `charts/` — the four Ubuntu Circle (Look B) chart cards, made by `charts.py`
- `engine.py`, `data.py`, `run_us_index.py` — the code; `test_engine.py` — the tests

```bash
pip install pandas numpy scipy tabulate pytest
GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/datasets/s-and-p-500 /home/user/datasets/s-and-p-500
cd research && python -m pytest -q && python run_us_index.py && python charts.py
```
