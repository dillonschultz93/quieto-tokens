# @quieto/tokens

## 0.4.0

### Minor Changes

- 322d2d5: Add `init --from-codebase` to bootstrap a token system from an existing project's stylesheets. Quieto scans CSS/SCSS/Sass/Less/Styl files, infers a seed (brand color, additional hues by role, spacing base, type scale, font families/weights, and light/dark themes), and feeds it into the normal accessible-ramp pipeline — printing an inference summary and dropping you into the usual preview/override step before anything is written. Accepts `--from-codebase=<path>` to scan a specific directory. It proposes a system and stops; use `migrate` afterward to swap hardcoded values for the generated tokens.

## 0.3.0

### Minor Changes

- Add 7 Claude Code skills for design token workflows (init, audit, migrate, component, category-add, contrast, update)

## 0.2.2

### Patch Changes

- Use DTCG `fontSize` for type-scale primitives and semantic font-size roles so tools like Tokens Studio classify them as font size, not generic dimension

## 0.2.1

### Patch Changes

- 181a77b: Updated the README to reflect the fact that this package is now published to NPM

## 0.2.0

### Minor Changes

- Adding a Changelog
