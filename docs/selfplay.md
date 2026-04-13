# Self-Play

Self-play is the only data source. The current champion plays games against
itself. Each move is selected by MCTS guided by the network's policy and value
heads. The MCTS-improved visit distribution becomes the training target.

## Output

Each iteration writes to `data/iter_{N}/games.bin` as a packed binary record.
Games are roughly 60-80 plies on average; a 100-game iteration produces ~6,000
training samples.
