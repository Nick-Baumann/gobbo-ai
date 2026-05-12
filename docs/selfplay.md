# Self-Play

Self-play is the only data source. The current champion plays games against
itself. Each move is selected by MCTS guided by the network's policy and value
heads. The MCTS-improved visit distribution becomes the training target.

## Output

Each iteration writes to `data/iter_{N}/games.bin` as a packed binary record.
Games are roughly 60-80 plies on average; a 100-game iteration produces ~6,000
training samples.

## Temperature schedule

For the first 30 plies of every game, moves are sampled from the visit
distribution with temperature 1.0. Beyond ply 30 the engine plays the highest-
visit move greedily. This keeps opening exploration broad while ensuring the
training labels reflect best-play in the middlegame and endgame.

## Resignation

A game is resigned early if the value head has output below -0.95 for 6
consecutive plies. Both engines must agree before resignation fires (the
opponent must also predict winning); this avoids accidentally pruning out
positions where the network's value head is wrong but recoverable.
