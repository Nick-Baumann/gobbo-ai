# Monte Carlo Tree Search

Tree search uses the PUCT formula from AlphaZero: child score is empirical
action value plus an exploration bonus weighted by the network's prior and the
parent's visit count.

```
PUCT(s, a) = Q(s, a) + c_puct * P(s, a) * sqrt(N(s)) / (1 + N(s, a))
```

Dirichlet noise is mixed into the root prior on every search to enforce
exploration.
