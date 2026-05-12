# Arena

The arena is the gate. A candidate network plays a 100-game match against the
reigning champion. Colors alternate. Both engines run with the same MCTS
budget. Promotion requires win-rate >= 55% (counting draws as half).

If the candidate fails, it is archived and self-play continues from the
existing champion. Samples are not wasted -- they roll forward in the buffer.

## Why 55%

50% would let noise win. 60% is too tight for a single 100-game match (the
standard error on a binomial proportion at n=100 is ~5%, so a true 55% engine
might hit 60% only ~17% of the time).

55% is the smallest threshold that meaningfully clears noise on a 100-game
match while not stalling the loop on real but small improvements.

## Tree reuse

Both engines reuse their MCTS tree across moves within a game. The tree is
cleared between games but not between moves -- this gives an effective
multiplier on simulation budget without paying for it.
