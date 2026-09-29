"""Four Ubuntu Circle Look B cards for the personal money plan (MONEY-PLAN.md).

    python research/plan_cards.py

Layout follows MOTION.md: one quote, centred near y 505, 58 px, 82 px line pitch. Cream text,
gold on the closing clause. Divider 180 x 2 px about 50 px below the last line. Rings are
centred behind the quote.
"""
from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Circle, Rectangle

from charts import (BOTTOM, CENTRE, CREAM, DARK_GOLD, DEEP_TEAL, FLAG, FOOTER, GOLD, PT, RING,
                    SANS, SANS_B, SERIF, SERIF_BI, TEAL, TOP)

OUT = Path(__file__).parent / "charts"
CENTRE_Y, PITCH, SIZE = 505, 82, 58

# (cream lines, gold lines, optional small note). Gold always closes the quote.
CARDS = [
    (["Open a tax-free account,"], ["then automate R500", "every month."], None),
    (["Keep shares to about 40%,"], ["so a crash stays bearable."], None),
    (["Decide before the crash:"], ["I will not sell."], None),
    (["R500 a month for 8 years"], ["could grow to", "about R61,000."],
     "Illustration at 6% a year on R48,000 paid in · not a promise"),
]


def card(n, cream, gold, note):
    fig = plt.figure(figsize=(10.8, 10.8), dpi=100)
    bg = fig.add_axes([0, 0, 1, 1])
    bg.set_axis_off()
    bg.set_xlim(0, 1080)
    bg.set_ylim(1080, 0)
    # Look B gradient: lightest band behind the quote, darker at top and bottom
    ys = np.linspace(0, 1, 1080)
    stops = [(0.0, TOP), (CENTRE_Y / 1080, CENTRE), (1.0, BOTTOM)]
    rgb = np.array([matplotlib.colors.to_rgb(c) for _, c in stops])
    pos = [p for p, _ in stops]
    grad = np.stack([np.interp(ys, pos, rgb[:, i]) for i in range(3)], axis=1)
    bg.imshow(grad[:, None, :], aspect="auto", extent=[0, 1080, 1080, 0])
    for r in range(75, 1300, 75):
        bg.add_patch(Circle((540, CENTRE_Y), r, fill=False, ec=RING, lw=1.5 * PT))
    for c, a, b in FLAG:
        bg.add_patch(Rectangle((a, 0), b - a, 7, fc=c, ec="none"))
    bg.add_patch(Rectangle((0, 7), 6, 1073, fc=GOLD, ec="none"))
    bg.text(540, 45, f"UBUNTU CIRCLE · MONEY PLAN {n} OF {len(CARDS)}", color=TEAL,
            fontproperties=SANS_B, fontsize=17 * PT, ha="center", va="center")
    bg.add_patch(Rectangle((340, 64), 400, 1, fc=GOLD, ec="none"))

    lines = [(t, CREAM) for t in cream] + [(t, GOLD) for t in gold]
    top = CENTRE_Y - (len(lines) - 1) * PITCH / 2
    for i, (t, col) in enumerate(lines):
        bg.text(540, top + i * PITCH, t, color=col, fontproperties=SERIF_BI,
                fontsize=SIZE * PT, ha="center", va="center")
    last = top + (len(lines) - 1) * PITCH
    bg.add_patch(Rectangle((450, last + 50), 180, 2, fc=DARK_GOLD, ec="none"))

    if note:
        bg.text(540, 985, note, color=CREAM, fontproperties=SERIF, fontsize=14 * PT,
                ha="center", va="center")
    bg.add_patch(Rectangle((0, 1016), 1080, 1, fc=DEEP_TEAL, ec="none"))
    bg.add_patch(Rectangle((0, 1017), 1080, 63, fc=FOOTER, ec="none"))
    bg.text(40, 1048, "Your Voice is Your Design", color=TEAL, fontproperties=SANS,
            fontsize=17 * PT, ha="left", va="center")
    bg.text(1040, 1048, "Dr Rebone Gcabo", color=GOLD, fontproperties=SANS_B,
            fontsize=17 * PT, ha="right", va="center")

    # widest line, in px, so overflow is caught rather than eyeballed
    fig.canvas.draw()
    rend = fig.canvas.get_renderer()
    widest = max(t.get_window_extent(rend).width for t in bg.texts[2:2 + len(lines)])
    return fig, widest


def main():
    OUT.mkdir(exist_ok=True)
    for n, (cream, gold, note) in enumerate(CARDS, 1):
        fig, widest = card(n, cream, gold, note)
        assert widest <= 960, f"card {n}: quote is {widest:.0f}px wide, keep it under 960"
        fig.savefig(OUT / f"plan-{n}.png", dpi=100)
        plt.close(fig)
        print(f"plan-{n}.png  widest line {widest:.0f}px")


if __name__ == "__main__":
    main()
