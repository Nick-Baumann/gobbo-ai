# Network Architecture

Residual CNN with policy and value heads.

| Component | Spec |
|-----------|------|
| Input | 18 x 8 x 8 |
| Trunk | 10 residual blocks, 128 filters |
| Policy head | softmax over 4,672 move slots |
| Value head | tanh, scalar in [-1, 1] |
| Parameters | 9,584,193 |

## Input planes

| Index | Plane |
|-------|-------|
| 0-5 | Own pieces (P, N, B, R, Q, K) |
| 6-11 | Opponent pieces |
| 12 | Side to move |
| 13 | Castling rights, white kingside |
| 14 | Castling rights, white queenside |
| 15 | Castling rights, black kingside |
| 16 | Castling rights, black queenside |
| 17 | Halfmove clock / 100 |

The encoding is canonicalized so the side to move always plays "up" the board.
This halves the effective input space and is the same trick AlphaZero used.
