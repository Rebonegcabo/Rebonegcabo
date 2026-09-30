# Ubuntu Circle — animated, days 2–30

One renderer for every card in the 30-day series. Each video is 15 s, 1080 × 1080, 60 fps, silent. Its last frame reproduces the original card (days 2–7 differ only in the footer, where Rebone's name was added) (from `ubuntu-circle-30-days.zip`) to within 0.4% per pixel before video compression. Every word was also checked individually against its card.

Built from [`MOTION.md`](../../MOTION.md), plus Rebone's answers on motion, which are not in MOTION.md yet:

- **Look B (days 8–30)**, answered 27 Sep: the card's frame builds first. The quote arrives word by word with a soft fade and a small rise. The gold closing phrase comes after a beat, then the divider. The rings breathe outward throughout. Long quotes speed up the word pace (never slower than one word every 0.32 s), so every quote has landed by about 8 s.
- **Look A (days 2–7, #StopFemicide)**, answered 30 Sep: everything is still from the first frame, including the helpline. Only the quote moves: it fades in whole, from 1.0 to 2.8 s. The helpline sits bottom left and "Dr Rebone Gcabo" bottom right, in teal (added 30 Sep, and recorded in MOTION.md).

## Send calendar

Each day's video is emailed to Rebone at about 06:00 SAST with a download link.

| Day | Date | Look | Quote |
|---|---|---|---|
| 2 | Thu 1 Oct | A | Stop adjusting her life around the perpetrator. Hold the perpetrator. |
| 3 | Fri 2 Oct | A | If every solution requires the woman to change, we are not looking hard enough at the room. |
| 4 | Sat 3 Oct | A | Umuntu ngumuntu ngabantu. If one woman is not safe, none of us is whole. |
| 5 | Sun 4 Oct | A | Men: silence is also a position. Choose again. |
| 6 | Mon 5 Oct | A | Nine women in Ekurhuleni. Nine families. We will not grow accustomed to this. |
| 7 | Tue 6 Oct | A | A country is measured by whether its women can walk home. |
| 8 | Wed 7 Oct | B | The most beautiful vessels are not the newest ones. They are the ones that know how to pour. |
| 9 | Thu 8 Oct | B | Your vessel was never meant to stay full. It was always preparing you to pour. |
| 10 | Fri 9 Oct | B | You do not arrive at wisdom and hold it. You become wise by giving it away. |
| 11 | Sat 10 Oct | B | Stop asking how much more you can achieve. Start asking who will flourish because you lived. |
| 12 | Sun 11 Oct | B | An elder is not honoured for lasting the longest. An elder is honoured because others were fed. |
| 13 | Mon 12 Oct | B | Being invited and being included are not the same thing. |
| 14 | Tue 13 Oct | B | A seat is not a vote. |
| 15 | Wed 14 Oct | B | They were not invited. They included themselves. |
| 16 | Thu 15 Oct | B | Invitation is where sponsorship starts. It is not where it is allowed to end. |
| 17 | Fri 16 Oct | B | Say her name when she is not in the room. |
| 18 | Sat 17 Oct | B | You do not have to run the institution to sponsor someone. You only have to be one room ahead of her. |
| 19 | Sun 18 Oct | B | Confidence is the feeling that the room will receive you. Self-trust is standing in what you know when it does not. |
| 20 | Mon 19 Oct | B | We have become fluent in the afterthought. It is time to speak in the present tense. |
| 21 | Tue 20 Oct | B | The knowing was real. The institution simply had no container for it. |
| 22 | Wed 21 Oct | B | The room that hears you fully is the most costly exposure there is. Let yourself be received anyway. |
| 23 | Thu 22 Oct | B | We have become very good at measuring what women produce. We remain unsophisticated at measuring what women carry. |
| 24 | Fri 23 Oct | B | Progress and equality are not the same thing. |
| 25 | Sat 24 Oct | B | Data tells us what. Behavioural science tells us why. Women's stories tell us what the numbers cannot see. |
| 26 | Sun 25 Oct | B | Name one barrier you actually have the power to remove. Then remove it. |
| 27 | Mon 26 Oct | B | Honesty, trust and integrity by design. |
| 28 | Tue 27 Oct | B | Stay curious. Stay malleable. |
| 29 | Wed 28 Oct | B | Umuntu ngumuntu ngabantu. You are because we are. |
| 30 | Thu 29 Oct | B | The circle grows stronger every time one woman names what she has been carrying alone. |

## Files

- `days.js`: the 30 quotes and their line breaks, where the gold starts (read from each card's pixels), and whole-pixel word corrections found by comparing each word with its card.
- `card.js`: the renderer, a pure `render(t)`. Open `index.html?day=N` through a local web server for a live preview.
- `render.mjs`: renders videos or stills.
- `out/ubuntu-circle-day-NN.mp4`: the finished videos.

```bash
node animations/ubuntu-circle/render.mjs --days 2-30            # all videos
node animations/ubuntu-circle/render.mjs --days 5 --stills 899  # one still
```

Needs Playwright's Chromium and an ffmpeg (`FFMPEG=/path/to/ffmpeg`). Fonts: DejaVu Serif (DejaVu licence) and Liberation Sans (SIL Open Font License), in `fonts/`.
