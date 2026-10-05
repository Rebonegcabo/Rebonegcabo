// Ubuntu Circle — the 30 cards, transcribed from ubuntu-circle-30-days.zip.
// look: 'A' (Witness, days 1–7) or 'B' (Circle, days 8–30), per MOTION.md.
// gold: [line, x] — where the gold closing phrase starts, read from the card's pixels.
// nudge: {line: {word: dx}} — whole-pixel corrections where a word sits 1 px off the card.
// headerDx: shift of the header label, where a card sets it 1 px differently.
window.DAYS = {
  1: { look: 'A', gold: null, lines: ["Her safety is not her", "responsibility. It is ours."] },
  2: { look: 'A', gold: null, lines: ["Stop adjusting her life", "around the perpetrator.", "Hold the perpetrator."] },
  3: { look: 'A', gold: null, lines: ["If every solution requires", "the woman to change, we", "are not looking hard", "enough at the room."], nudge: {"3": {"0": -1, "1": -1}} },
  4: { look: 'A', gold: null, lines: ["Umuntu ngumuntu", "ngabantu. If one woman is", "not safe, none of us is", "whole."], nudge: {"1": {"3": -1}} },
  5: { look: 'A', gold: null, lines: ["Men: silence is also a", "position. Choose again."] },
  6: { look: 'A', gold: null, lines: ["Eleven women in", "Ekurhuleni. Eleven families.", "We will not grow", "accustomed to this."], nudge: {"3": {"2": 1, "1": 1}} },  // updated 5 Oct: the count is now eleven (was "Nine" on the original card)
  7: { look: 'A', gold: null, lines: ["A country is measured by", "whether its women can", "walk home."], nudge: {"0": {"2": -1}} },
  8: { look: 'B', gold: [3, 245], lines: ["The most beautiful vessels", "are not the newest ones.", "They are the ones that", "know how to pour."], nudge: {"0": {"1": -1}, "1": {"3": 1}, "2": {"3": 1}} },
  9: { look: 'B', gold: [3, 459], lines: ["Your vessel was never", "meant to stay full. It was", "always preparing you to", "pour."] },
  10: { look: 'B', gold: [3, 456], lines: ["You do not arrive at", "wisdom and hold it. You", "become wise by giving it", "away."] },
  11: { look: 'B', gold: [3, 105], lines: ["Stop asking how much", "more you can achieve.", "Start asking who will", "flourish because you lived."], nudge: {"0": {"2": 1}}, headerDx: 1 },
  12: { look: 'B', gold: [3, 279], lines: ["An elder is not honoured", "for lasting the longest. An", "elder is honoured because", "others were fed."], nudge: {"0": {"2": 1, "1": 1, "4": 1}, "3": {"2": 1}} },
  13: { look: 'B', gold: [2, 446], lines: ["Being invited and being", "included are not the same", "thing."] },
  14: { look: 'B', gold: null, lines: ["A seat is not a vote."] },
  15: { look: 'B', gold: [1, 113], lines: ["They were not invited.", "They included themselves."], nudge: {"0": {"2": -1}} },
  16: { look: 'B', gold: [3, 472], lines: ["Invitation is where", "sponsorship starts. It is", "not where it is allowed to", "end."], nudge: {"2": {"3": 1}} },
  17: { look: 'B', gold: [1, 280], lines: ["Say her name when she is", "not in the room."], nudge: {"0": {"2": 1, "1": 1, "3": 1}} },
  18: { look: 'B', gold: [3, 118], lines: ["You do not have to run the", "institution to sponsor", "someone. You only have to", "be one room ahead of her."], nudge: {"3": {"1": -1}} },
  19: { look: 'B', gold: [4, 393], lines: ["Confidence is the feeling", "that the room will receive", "you. Self-trust is standing", "in what you know when it", "does not."], nudge: {"1": {"1": 1}, "3": {"1": 1, "5": 1}} },
  20: { look: 'B', gold: [3, 445], lines: ["We have become fluent in", "the afterthought. It is time", "to speak in the present", "tense."], nudge: {"1": {"2": -1, "3": -1}, "2": {"2": -1}} },
  21: { look: 'B', gold: [2, 284], lines: ["The knowing was real. The", "institution simply had no", "container for it."] },
  22: { look: 'B', gold: [4, 418], lines: ["The room that hears you", "fully is the most costly", "exposure there is. Let", "yourself be received", "anyway."], nudge: {"1": {"2": -1}} },
  23: { look: 'B', gold: [5, 451], lines: ["We have become very good", "at measuring what women", "produce. We remain", "unsophisticated at", "measuring what women", "carry."], nudge: {"2": {"1": 1}} },
  24: { look: 'B', gold: [1, 226], lines: ["Progress and equality are", "not the same thing."] },
  25: { look: 'B', gold: [4, 357], lines: ["Data tells us what.", "Behavioural science tells", "us why. Women's stories", "tell us what the numbers", "cannot see."], nudge: {"2": {"2": -1}} },
  26: { look: 'B', gold: [2, 149], lines: ["Name one barrier you", "actually have the power to", "remove. Then remove it."] },
  27: { look: 'B', gold: [1, 226], lines: ["Honesty, trust and", "integrity by design."], nudge: {"1": {"1": 1, "2": 1}} },
  28: { look: 'B', gold: [1, 375], lines: ["Stay curious. Stay", "malleable."] },
  29: { look: 'B', gold: [2, 426], lines: ["Umuntu ngumuntu", "ngabantu. You are because", "we are."] },
  30: { look: 'B', gold: [3, 297], lines: ["The circle grows stronger", "every time one woman", "names what she has been", "carrying alone."] },
};
