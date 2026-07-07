---
"@quieto/tokens": patch
---

`init --from-codebase` now understands already-tokenized codebases: `var(--x)` references count as usage votes for the referenced custom property's resolved value (so the real accent color wins over single-use literals), `var()` references are resolved or ignored instead of leaking into font-family names, a dark `:root`/`body` background turns on light + dark theme generation even without `prefers-color-scheme` styles, and a warning is surfaced when an existing token system is detected.
