# Glossary

| Term | Definition |
|------|------------|
| Champion | The current best network. Source of all self-play. |
| Candidate | A freshly-trained network awaiting arena gating. |
| Iteration | One full pass through self-play, training, arena, deployment. |
| Sample | A single (position, policy, value) training tuple. |
| Replay buffer | The rolling window of recent samples used for training. |
| Arena | The 100-game match that gates promotion. |
| MCTS | Monte Carlo Tree Search, the move-selection algorithm. |
| PUCT | Upper-Confidence variant used inside MCTS. |
| Dirichlet noise | Random perturbation of the root prior, drives exploration. |
| Coach | The LLM that returns weakness reports per iteration. |
