# Git Branching Strategy

<!-- complexity: medium -->

- **`main`** — production-ready only; protected (requires PR + CI pass)
- **`develop`** — integration branch; protected (requires PR + CI pass)
- **`feature/US-XXXX-*`** — one branch per user story; squash-merge into develop
- **`bugfix/BUG-XXXX-*`** — one branch per bug; squash-merge into develop
- **`release/*`** — staging branch cut from develop before production deploy
- **`hotfix/*`** — emergency fixes branched from main

**Rule:** Never push directly to `main` or `develop`. Always open a PR.

---
