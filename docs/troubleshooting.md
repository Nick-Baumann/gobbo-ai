# Troubleshooting

## Loss explodes during training

Almost always a bad batch (NaN inputs from a corrupt sample). Re-run
`milton selfplay --validate` to scan the latest iteration's samples and
reject any that fail schema or contain non-finite values.

## Arena keeps failing the threshold

If the candidate consistently loses to the champion at <50%, something is
wrong with training (likely overfitting to recent self-play). Try widening
the buffer (`buffer_iterations = 6`) and reducing the learning rate.

## Lichess bot disconnects

The Lichess streaming endpoint sometimes silently halts. The daemon detects
no events for 90 seconds and reconnects automatically. If reconnects loop,
your token has been revoked or rate-limited.
