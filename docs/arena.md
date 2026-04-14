# Arena

The arena is the gate. A candidate network plays a 100-game match against the
reigning champion. Colors alternate. Both engines run with the same MCTS
budget. Promotion requires win-rate >= 55% (counting draws as half).

If the candidate fails, it is archived and self-play continues from the
existing champion. Samples are not wasted -- they roll forward in the buffer.
