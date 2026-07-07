# @quieto/skills

## 1.1.1

### Patch Changes

- 5a8f41a: design-token-init: document `--from-codebase` behavior on already-tokenized codebases (from @quieto/tokens 0.4.1) — `var()` references count as usage votes for the resolved value, a dark `:root`/`html`/`body` background infers light + dark themes, and the "Existing token system detected" warning means init rebuilds from scratch (use update/category-add to modify an existing system).

## 1.1.0

### Minor Changes

- design-token-init: document the new `init --from-codebase` flag, which bootstraps a token system by analyzing existing stylesheets (CSS/SCSS/Sass/Less/Styl) instead of prompting.

## 1.0.1

### Patch Changes

- f96a0ef: List skill directories explicitly in files field so they are included in the published tarball
