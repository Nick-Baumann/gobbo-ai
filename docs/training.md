# Training

The trainer consumes the latest sample window (last N iterations) and updates
the network for a fixed number of epochs. Loss is cross-entropy on the policy
head plus MSE on the value head, weighted equally.

## Schedule

| Hyperparameter | Value |
|----------------|-------|
| Batch size | 256 |
| Learning rate | 1e-3 |
| Weight decay | 1e-4 |
| Epochs / iter | 10 |
| Buffer iters | 4 |

## Replay buffer

The buffer holds samples from the last 4 iterations (~24,000 samples). Older
samples are dropped. This window is short enough that the network sees recent
self-play (avoiding stale targets) and long enough that minibatches are
genuinely random.

## Optimizer

AdamW with weight decay 1e-4. Learning rate is constant at 1e-3 for the first
50 iterations, then decays linearly to 1e-4 over the next 100. No restarts.
Gradient norm is clipped at 1.0.
