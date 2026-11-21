# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/longjie-xing/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/longjie-xing/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks every pre-token protocol in a sealed DefiLlama snapshot by what its launch would be worth, and shows how to farm each one. It reads a sealed snapshot of every protocol and writes a web dashboard that ranks the protocols with no token yet by what their launch would be worth, each with the steps to farm it. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

The radar-2 model scores each protocol from the snapshot's own figures only: TVL times the category's benchmark multiple — the median market-cap-to-TVL ratio of the live-token protocols in the same category, falling back to the global median — times a seven-day growth multiplier, times a maturity multiplier for how long the protocol has run with no token. No protocol name is special-cased. The board covers all 40 watchlist protocols plus every other rankable pre-token protocol below the floor (198 rows), each with a seven-step farm plan carrying its cost and time. The dashboard is a static page with no network: a sortable, filterable board, a top-5 spotlight, a detail view per protocol that recomputes the model live, and the category benchmarks the model is built on.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

Node 22 or later, standard library only. The program writes `out/board.json`, `out/data.js`, `out/dashboard/`, `out/screenshots/` and `out/dossier.json`. The snapshot is the sealed `snapshot.json` from the competition kit (`input/snapshot.json`).

---

<sub>Entered on [make.fun](https://make.fun/?ref=397wsy61&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
