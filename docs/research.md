# Research Notes

References and prior art that inform the design.

| Year | Title | Relevance |
|------|-------|-----------|
| 2017 | "Mastering Chess and Shogi by Self-Play" (Silver et al.) | The base recipe. |
| 2019 | "Polygames" (Cazenave et al.) | Open-source AlphaZero family, useful for hyperparameter cross-checks. |
| 2020 | "KataGo" (Wu) | Auxiliary heads, sample reuse strategies. |
| 2021 | "Acquisition of Chess Knowledge in AlphaZero" (McGrath et al.) | What features the network learns and when. |
| 2024 | "Grandmaster-Level Chess Without Search" (Ruoss et al.) | Strong evidence that the network alone is doing most of the work. |

## Open questions

- Does coach-driven sample reweighting actually compress the long tail, or just
  shift training compute around?
- Does a fixed network beat a slowly-decaying replay buffer at the same total
  compute?
