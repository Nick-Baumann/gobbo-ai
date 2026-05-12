# Monte Carlo Tree Search

Tree search uses the PUCT formula from AlphaZero: child score is empirical
action value plus an exploration bonus weighted by the network's prior and the
parent's visit count.

```
PUCT(s, a) = Q(s, a) + c_puct * P(s, a) * sqrt(N(s)) / (1 + N(s, a))
```

Dirichlet noise is mixed into the root prior on every search to enforce
exploration.

## Dirichlet noise

At the root only, the network's prior `P` is mixed with a sample from
`Dirichlet(alpha)`:

```
P_root = (1 - epsilon) * P + epsilon * Dirichlet(alpha)
```

Defaults: `alpha = 0.3`, `epsilon = 0.25`. These match AlphaZero. The noise is
disabled in arena play (the engines should play their best, not explore).

## Virtual loss

Parallel simulations apply a virtual loss to nodes during selection so multiple
threads explore different branches. The virtual loss is removed when the
simulation completes.
