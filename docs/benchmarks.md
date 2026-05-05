# Benchmarks

All numbers measured on a single Mac Mini M4 (16 GB unified memory), MPS
backend for inference, CPU pool for tree search.

## Inference

| Batch size | Throughput | Latency |
|------------|------------|---------|
| 1 | 480 pos/s | 2.1 ms |
| 16 | 5,820 pos/s | 2.7 ms |
| 64 | 18,400 pos/s | 3.5 ms |
| 256 | 23,400 pos/s | 11.0 ms |

## Self-play

| Threads | Games / hour |
|---------|--------------|
| 4 | 38 |
| 6 | 58 |
| 8 | 78 |
| 10 | 84 |

Diminishing returns above 8 threads -- the M4 has 4 P-cores and 6 E-cores;
the search saturates the P-cores first.
