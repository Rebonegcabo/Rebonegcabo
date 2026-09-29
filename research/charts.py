"""Research charts as 1080 x 1080 Ubuntu Circle Look B cards. Every colour, font, size and
position comes from MOTION.md.

    python research/charts.py      (run after run_us_index.py)
"""
from __future__ import annotations

import os
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib import font_manager as fm
from matplotlib.lines import Line2D
from matplotlib.patches import Circle, Rectangle

import run_us_index as R
from data import load_shiller

OUT = Path(__file__).parent / "charts"

# ---- MOTION.md section 1 (the only colours allowed)
TOP, CENTRE, BOTTOM = "#13342B", "#17392F", "#113129"
RING, FOOTER = "#183C32", "#0A1F1A"
CREAM, GOLD, DARK_GOLD = "#F4F0E8", "#D4A843", "#8A6D1D"
TEAL, DEEP_TEAL = "#4CAF96", "#2E7D6B"
FLAG = [("#007A4D", 0, 356), ("#FFB612", 356, 540), ("#DE3831", 540, 723),
        ("#002395", 723, 864), ("#FFFFFF", 864, 1080)]

# ---- MOTION.md section 2 (fonts). Pixel sizes on a 1080 frame; at dpi 100, 1 px = 0.72 pt
PT = 0.72
MPL_TTF = Path(matplotlib.get_data_path()) / "fonts/ttf"
SERIF_BI = fm.FontProperties(fname=str(MPL_TTF / "DejaVuSerif-BoldItalic.ttf"))
SERIF = fm.FontProperties(fname=str(MPL_TTF / "DejaVuSerif.ttf"))
SANS_B = fm.FontProperties(fname="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf")
SANS = fm.FontProperties(fname="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf")

HEADER = "UBUNTU CIRCLE · MARKET RESEARCH"
PLOT = dict(left=120, right=1000, top=330, bottom=930)   # px box for the chart itself
LABEL_PX = 17                                            # chart labels at header-label size


def fx(x):  # px -> figure fraction
    return x / 1080


def fy(y):
    return 1 - y / 1080


def card(cream_line: str, gold_line: str):
    """Draw the Look B frame and a two-line title (cream, then gold closing phrase)."""
    fig = plt.figure(figsize=(10.8, 10.8), dpi=100)
    bg = fig.add_axes([0, 0, 1, 1], zorder=-10)
    bg.set_axis_off()
    # soft vertical gradient: darker top and bottom, lightest band behind the title
    ys = np.linspace(0, 1, 1080)
    stops = [(0.0, TOP), (0.20, CENTRE), (1.0, BOTTOM)]
    rgb = np.array([matplotlib.colors.to_rgb(c) for _, c in stops])
    pos = [p for p, _ in stops]
    grad = np.stack([np.interp(ys, pos, rgb[:, i]) for i in range(3)], axis=1)
    bg.imshow(grad[:, None, :], aspect="auto", extent=[0, 1080, 1080, 0])
    bg.set_xlim(0, 1080)
    bg.set_ylim(1080, 0)
    # faint concentric rings centred behind the title, ~75 px apart, 1.5 px lines
    for r in range(75, 1400, 75):
        bg.add_patch(Circle((540, 190), r, fill=False, ec=RING, lw=1.5 * PT))
    # flag stripe (7 px), gold left border (6 px)
    for c, a, b in FLAG:
        bg.add_patch(Rectangle((a, 0), b - a, 7, fc=c, ec="none"))
    bg.add_patch(Rectangle((0, 7), 6, 1073, fc=GOLD, ec="none"))
    # header label + gold rule at y 64 (x 340-740)
    bg.text(540, 45, HEADER, color=TEAL, fontproperties=SANS_B, fontsize=17 * PT,
            ha="center", va="center")
    bg.add_patch(Rectangle((340, 64), 400, 1, fc=GOLD, ec="none"))
    # title: DejaVu Serif Bold Italic 58 px, line pitch 82 px; gold closes it
    bg.text(540, 140, cream_line, color=CREAM, fontproperties=SERIF_BI, fontsize=58 * PT,
            ha="center", va="center")
    bg.text(540, 222, gold_line, color=GOLD, fontproperties=SERIF_BI, fontsize=58 * PT,
            ha="center", va="center")
    # dark-gold divider 180 x 2 px, ~50 px below the last line
    bg.add_patch(Rectangle((450, 272), 180, 2, fc=DARK_GOLD, ec="none"))
    # footer: deep-teal rule at y 1016, 63 px footer-green bar
    bg.add_patch(Rectangle((0, 1016), 1080, 1, fc=DEEP_TEAL, ec="none"))
    bg.add_patch(Rectangle((0, 1017), 1080, 63, fc=FOOTER, ec="none"))
    bg.text(40, 1048, "Your Voice is Your Design", color=TEAL, fontproperties=SANS,
            fontsize=17 * PT, ha="left", va="center")
    bg.text(1040, 1048, "Dr Rebone Gcabo", color=GOLD, fontproperties=SANS_B,
            fontsize=17 * PT, ha="right", va="center")

    ax = fig.add_axes([fx(PLOT["left"]), fy(PLOT["bottom"]),
                       fx(PLOT["right"] - PLOT["left"]), (PLOT["bottom"] - PLOT["top"]) / 1080])
    ax.set_facecolor("none")
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(DEEP_TEAL)
        ax.spines[s].set_linewidth(1 * PT)
    ax.tick_params(colors=DEEP_TEAL, width=1 * PT, labelcolor=CREAM, labelsize=LABEL_PX * PT)
    for lab in ax.get_xticklabels() + ax.get_yticklabels():
        lab.set_fontproperties(SERIF)
    ax.grid(True, axis="y", color=DEEP_TEAL, lw=1 * PT)
    ax.set_axisbelow(True)
    return fig, bg, ax


def note(bg, text):
    bg.text(540, 985, text, color=CREAM, fontproperties=SERIF, fontsize=14 * PT,
            ha="center", va="center")


def style_ticks(ax):
    for lab in ax.get_xticklabels() + ax.get_yticklabels():
        lab.set_fontproperties(SERIF)
        lab.set_fontsize(LABEL_PX * PT)
        lab.set_color(CREAM)


def legend(ax, items, loc="upper left"):
    handles = [Line2D([0], [0], color=c, lw=ls_w, marker=mk, ms=9, linestyle=ls)
               for c, ls_w, mk, ls, _ in items]
    lg = ax.legend(handles, [t for *_, t in items], loc=loc, frameon=False,
                   prop=SERIF, labelcolor=CREAM)
    for t in lg.get_texts():
        t.set_fontsize(LABEL_PX * PT)


NOTE = "S&P 500 monthly, Shiller data · signal lagged 2 months · 0.10% per switch · cash at 0%"


def series(cash_col="cash_lo"):
    d = load_shiller()
    d = d.loc[d["ret"].first_valid_index():]
    s1 = R.backtest("S1 Trend (SMA)", d, cash_col, 10).loc["1881":]
    bh = R.bh(d, cash_col).reindex(s1.index)
    return s1["net"], bh["net"]


def oos_band(ax, y_text):
    ax.axvspan(pd.Timestamp("2018-01-01"), pd.Timestamp("2026-08-01"), color=RING, zorder=0)
    ax.axvline(pd.Timestamp("2018-01-01"), color=DEEP_TEAL, lw=1 * PT)
    ax.text(pd.Timestamp("2016-06-01"), y_text, "out of sample 2018+ →", color=CREAM,
            fontproperties=SERIF, fontsize=14 * PT, ha="right", va="center")


def chart_growth():
    lo, bh = series("cash_lo")
    hi, _ = series("cash_hi")
    g_lo, g_hi, gb = (1 + lo).cumprod(), (1 + hi).cumprod(), (1 + bh).cumprod()
    fig, bg, ax = card("At best, trend kept pace;", "since 2018 it fell behind.")
    oos_band(ax, 0.8)
    ax.plot(gb.index, gb, color=CREAM, lw=2 * PT)
    ax.plot(g_hi.index, g_hi, color=TEAL, lw=2 * PT)
    ax.plot(g_lo.index, g_lo, color=TEAL, lw=2 * PT, linestyle=(0, (5, 3)))
    ax.set_yscale("log")
    ax.set_yticks([1, 10, 100, 1e3, 1e4, 1e5])
    ax.set_yticklabels(["$1", "$10", "$100", "$1k", "$10k", "$100k"])
    ax.set_ylim(0.5, 3e6)
    ax.set_xlim(pd.Timestamp("1881-01-01"), pd.Timestamp("2026-12-31"))
    ax.minorticks_off()
    k = lambda g: f"${g.iloc[-1] / 1e3:,.0f}k"
    legend(ax, [(CREAM, 2 * PT, None, "-", f"Buy & hold, total return: {k(gb)}"),
                (TEAL, 2 * PT, None, "-", f"Trend, cash earns the 10-year yield: {k(g_hi)}"),
                (TEAL, 2 * PT, None, (0, (5, 3)), f"Trend, cash earns 0%: {k(g_lo)}")])
    style_ticks(ax)
    note(bg, "Growth of $1, 1881–2026, log scale · S&P 500 monthly, Shiller data · "
             "signal lagged 2 months · 0.10% per switch")
    return fig


def chart_drawdown():
    s1, bh = series()
    dd = lambda r: (1 + r).cumprod() / (1 + r).cumprod().cummax() - 1
    d1, db = dd(s1), dd(bh)
    fig, bg, ax = card("Its worst fall was −52%,", "against −82% for holding.")
    oos_band(ax, -70)
    ax.plot(db.index, db * 100, color=CREAM, lw=2 * PT)
    ax.plot(d1.index, d1 * 100, color=TEAL, lw=2 * PT)
    ax.set_ylim(-90, 5)
    ax.set_yticks([0, -20, -40, -60, -80])
    ax.set_yticklabels(["0%", "−20%", "−40%", "−60%", "−80%"])
    ax.set_xlim(pd.Timestamp("1881-01-01"), pd.Timestamp("2026-12-31"))
    t_b, t_1 = db.idxmin(), d1.idxmin()
    ax.plot([t_b], [db.min() * 100], "o", color=CREAM, ms=8, mec=CENTRE, mew=2 * PT)
    ax.plot([t_1], [d1.min() * 100], "o", color=TEAL, ms=8, mec=CENTRE, mew=2 * PT)
    ax.text(t_b + pd.Timedelta(days=1500), db.min() * 100, f"Buy & hold {db.min():.0%}".replace("-", "−"),
            color=CREAM, fontproperties=SERIF, fontsize=LABEL_PX * PT, va="center")
    ax.text(t_1 + pd.Timedelta(days=1500), d1.min() * 100, f"Trend {d1.min():.0%}".replace("-", "−"),
            color=CREAM, fontproperties=SERIF, fontsize=LABEL_PX * PT, va="center")
    legend(ax, [(CREAM, 2 * PT, None, "-", "Buy & hold"),
                (TEAL, 2 * PT, None, "-", "Trend (S1)")], loc=(0.58, 0.04))
    style_ticks(ax)
    note(bg, "Fall from previous peak, 1881–2026 · " + NOTE.split(" · ", 1)[1])
    return fig


def dot_chart(rows, title, xlabel, note_text, ref_label, xlim):
    """rows: list of (label, strategy value, reference value)."""
    fig, bg, ax = card(*title)
    ax.set_position([fx(210), fy(PLOT["bottom"]), fx(PLOT["right"] - 210),
                     (PLOT["bottom"] - PLOT["top"]) / 1080])
    ax.grid(False)
    ax.grid(True, axis="x", color=DEEP_TEAL, lw=1 * PT)
    y = np.arange(len(rows))[::-1]
    for yi, (lab, v, ref) in zip(y, rows):
        ax.plot([min(v, ref), max(v, ref)], [yi, yi], color=DEEP_TEAL, lw=2 * PT, zorder=1)
        ax.plot([ref], [yi], "o", color=CREAM, ms=10, mec=CENTRE, mew=2 * PT, zorder=2)
        ax.plot([v], [yi], "o", color=TEAL, ms=10, mec=CENTRE, mew=2 * PT, zorder=3)
        ax.text(max(v, ref) + 0.03, yi, f"{v:.2f} vs {ref:.2f}", color=CREAM,
                fontproperties=SERIF, fontsize=LABEL_PX * PT, va="center")
    ax.set_yticks(y)
    ax.set_yticklabels([r[0] for r in rows])
    ax.set_xlim(*xlim)
    ax.set_ylim(-0.7, len(rows) - 0.3)
    legend(ax, [(TEAL, 0, "o", "", "Strategy"), (CREAM, 0, "o", "", ref_label)],
           loc="upper left")
    style_ticks(ax)
    note(bg, xlabel + " · " + note_text)
    return fig


SHORT = {"S1 Trend (SMA)": "Trend", "S2 TS momentum": "Momentum", "S3 CAPE valuation": "CAPE",
         "S4 Equity risk premium": "Risk premium", "S5 Seasonal (Nov-Apr)": "Seasonal",
         "S6 Vol target": "Vol target"}


def chart_oos():
    o = pd.read_csv(R.OUT / "out_of_sample.csv")
    o = o[(o.cash == "cash_lo") & o.strategy.isin(SHORT)]
    rows = [(SHORT[r.strategy], r.sharpe, r.bh_sharpe_same_window) for r in o.itertuples()]
    return dot_chart(rows, ("Since 2018, four of six", "trailed simply holding."),
                     "Sharpe ratio, 2018 to Aug 2026",
                     "CAPE and Risk premium end Jun 2023 · cash at 0%",
                     "Buy & hold, same months", (0.3, 1.45))


def chart_sensitivity():
    rb = pd.read_csv(R.OUT / "robustness.csv")
    rb = rb[rb.cash == "cash_lo"]
    fig, bg, ax = card("Results held across settings;", "no one choice drove them.")
    ax.set_position([fx(210), fy(PLOT["bottom"]), fx(PLOT["right"] - 210),
                     (PLOT["bottom"] - PLOT["top"]) / 1080])
    ax.grid(False)
    ax.grid(True, axis="x", color=DEEP_TEAL, lw=1 * PT)
    y = np.arange(len(rb))[::-1]
    for yi, r in zip(y, rb.itertuples()):
        row = rb.loc[r.Index]
        vals = [v for k, v in row.items() if k.startswith("sens_") and pd.notna(v)] + [r.is_sharpe]
        ax.plot([min(vals), max(vals)], [yi, yi], color=DEEP_TEAL, lw=2 * PT, zorder=1)
        ax.plot(vals, [yi] * len(vals), "o", color=TEAL, ms=8, mec=CENTRE, mew=2 * PT, zorder=2)
        ax.plot([r.is_sharpe], [yi], "o", color=CREAM, ms=11, mec=CENTRE, mew=2 * PT, zorder=3)
        ax.text(max(vals) + 0.015, yi, f"{min(vals):.2f}–{max(vals):.2f}", color=CREAM,
                fontproperties=SERIF, fontsize=LABEL_PX * PT, va="center")
    bh = rb.bh_is_sharpe.iloc[0]
    ax.axvline(bh, color=CREAM, lw=1 * PT, linestyle=(0, (4, 4)))
    ax.text(bh + 0.006, len(rb) - 0.45, f"Buy & hold {bh:.2f}", color=CREAM, fontproperties=SERIF,
            fontsize=LABEL_PX * PT, ha="left", va="bottom")
    ax.set_yticks(y)
    ax.set_yticklabels([SHORT[s] for s in rb.strategy])
    ax.set_xlim(0.4, 1.0)
    ax.set_ylim(-0.7, len(rb) - 0.1)
    legend(ax, [(CREAM, 0, "o", "", "Pre-registered setting"),
                (TEAL, 0, "o", "", "Alternative settings")], loc="upper left")
    style_ticks(ax)
    note(bg, "Sharpe ratio, 1881–2017, at each tested setting · CAPE and Risk premium "
             "from 1901 · cash at 0%")
    return fig


def main():
    OUT.mkdir(exist_ok=True)
    for name, fn in (("01-growth", chart_growth), ("02-drawdown", chart_drawdown),
                     ("03-out-of-sample", chart_oos), ("04-sensitivity", chart_sensitivity)):
        fig = fn()
        fig.savefig(OUT / f"{name}.png", dpi=100)
        plt.close(fig)
        print("wrote", OUT / f"{name}.png")


if __name__ == "__main__":
    main()
