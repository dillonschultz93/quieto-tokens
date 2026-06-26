---
"@quieto/tokens": minor
---

Add `init --from-codebase` to bootstrap a token system from an existing project's stylesheets. Quieto scans CSS/SCSS/Sass/Less/Styl files, infers a seed (brand color, additional hues by role, spacing base, type scale, font families/weights, and light/dark themes), and feeds it into the normal accessible-ramp pipeline — printing an inference summary and dropping you into the usual preview/override step before anything is written. Accepts `--from-codebase=<path>` to scan a specific directory. It proposes a system and stops; use `migrate` afterward to swap hardcoded values for the generated tokens.
