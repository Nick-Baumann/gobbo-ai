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
