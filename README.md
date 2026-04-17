# Quieto Tokens

An open source CLI tool that walks developers through creating a complete design token system and outputs platform-specific artifacts. Built on the Quieto ecosystem: [`@quieto/engine`](https://www.npmjs.com/package/@quieto/engine) for color math and [`@quieto/palettes`](https://www.npmjs.com/package/@quieto/palettes) for accessible color ramp generation.

> Tailwind gives you someone else's design decisions. Quieto gives you your own.

## What It Does

Quieto Tokens generates a three-tier design token system (primitive, semantic, and component tokens) from a few simple inputs. The output is [DTCG](https://design-tokens.github.io/community-group/format/)-aligned JSON source files and platform-specific builds via [Style Dictionary v4](https://styledictionary.com/).

**Quick-start mode** asks 3-4 questions and generates a production-ready token set. **Advanced mode** gives full control over every category.

## Installation

Quieto Tokens is not yet published to npm. For now, install it from source:

```bash
git clone https://github.com/dillonschultz93/quieto-tokens.git
cd quieto-tokens
npm install
npm run build
npm link
```

`npm link` makes the `quieto-tokens` binary available globally so you can run it from any project directory. Requires Node.js 18 or newer.

## Quick Start

From the root of the project you want to add tokens to, run:

```bash
quieto-tokens init
```

You'll be walked through a handful of prompts — pick a mode, provide a brand hex color, a base spacing unit, and a typography feel. Quieto then generates:

```
tokens/
  primitive/
    color.json            # Primitive color ramps (DTCG)
    spacing.json          # Primitive spacing scale
    typography.json       # Primitive type scale
  semantic/
    default/              # Semantic tokens (theme-agnostic references)
    light/                # Light-theme overrides (if dark mode enabled)
    dark/                 # Dark-theme overrides (if dark mode enabled)
build/
  tokens.css              # All primitives + default semantics
  primitives.css          # Primitives only
  light.css               # Light-theme semantic layer
  dark.css                # Dark-theme semantic layer
quieto.config.json        # Your answers, so you can re-run to modify
```

Running `quieto-tokens init` again on a project that already has `quieto.config.json` routes through a "Modify existing system" flow with your prior answers pre-filled — you only adjust what's changing.

### Advanced mode

Reach for advanced mode when the quick-start defaults aren't enough — you want to add hue ramps beyond your primary brand color, tune individual spacing steps, or override specific font families, sizes, weights, line heights, or letter spacing. Launch it with:

```bash
quieto-tokens init --advanced
```

or, when you run `quieto-tokens init` on a fresh project, choose "Advanced" at the mode prompt. Running `quieto-tokens init` on a project that already has a `quieto.config.json` always routes through advanced mode under the "Modify existing system" option, with every prior answer pre-filled so you only adjust what's changing.

Each category (color → spacing → typography) is an independently skippable step; skipping keeps the quick-start defaults for that category. All choices are persisted into `quieto.config.json` under `advanced.<category>` so you can re-run and refine without starting over.

> **Don't hand-edit `tokens/*.json` or `build/*.css`.** They're tool-generated (note the `$metadata.doNotEdit` banner at the top of every file). Edit `quieto.config.json` and re-run `quieto-tokens init` instead.

### Adding categories over time

`quieto-tokens init` only generates the three core categories (color, spacing, typography). When you're ready for more, use `add`:

```bash
quieto-tokens add shadow        # elevation ramp with soft/hard profiles
quieto-tokens add border        # widths + radii (largest radius becomes pill)
quieto-tokens add animation     # duration ramp + easing preset
```

Run `quieto-tokens add` with no argument to pick from a menu. Each invocation targets a single category — your existing `color / spacing / typography` files are not re-read or touched, and the corresponding JSON files for other previously-added categories only get refreshed timestamps when the pipeline rebuilds them for CSS emission.

Categories are written to disk in a canonical order (`color → spacing → typography → shadow → border → animation`) so diffs stay stable between runs. Re-running `add shadow` prompts for confirmation before overwriting the existing files. Manually removing a category name from `quieto.config.json → categories[]` is the documented way to prune: the next `add` invocation deletes the orphaned `tokens/primitive/<category>.json` and `tokens/semantic/<theme>/<category>.json` files automatically.

Like `init`, every `add`-generated file carries the `$metadata.doNotEdit` banner — edit `quieto.config.json` and re-run instead of hand-modifying the tokens.

### Token Tiers

- **Primitive** — Core values: color ramps, spacing scales, type scales. Obfuscation layer over raw values. _(shipped)_
- **Semantic** — UI-meaningful assignments: `color.background.primary`, `spacing.md`, `typography.body`. References primitives. _(shipped)_
- **Component** — Component-specific decisions: `button.primary.color.background.hover`. References semantics. _(planned — Epic 2)_

### Color Ramps

Every color hue is generated as a **10-step ramp** using the industry-standard labeling convention:

| Step | Role |
|---|---|
| `50` | Lightest — page backgrounds, subtle surfaces |
| `100`–`400` | Light to mid tones — hover states, soft fills, muted content |
| `500` | Base — typically the seed color, used for primary surfaces |
| `600`–`800` | Mid to dark tones — emphasis, active states, borders |
| `900` | Darkest — strong content, dark-theme backgrounds |

This matches Tailwind, Radix, and Material conventions, so Quieto-generated tokens drop into existing design systems predictably. All steps are WCAG AA–compliant against their intended usage context, enforced structurally by `@quieto/palettes`.

### Output Formats

- CSS custom properties _(shipped)_
- DTCG JSON source tokens _(shipped)_
- JSON for Figma Variables / Tokens Studio _(planned — Epic 4)_
- iOS Swift _(planned — Epic 4)_
- Android XML / Compose _(planned — Epic 4)_

## Key Features

- **Accessible by default** — All color tokens are WCAG AA compliant, enforced by `@quieto/palettes`
- **No framework lock-in** — Platform-native output that works with any framework
- **Light/dark themes** — Generated from a single yes/no question using the same primitive palette
- **Re-entrant editing** — Modify your token system without starting over
- **Design system changelog** — Automatic tracking of what changed and why (planned)
- **DTCG-aligned** — Interoperable with the growing design token tool ecosystem

## Status

This project is in active development. Progress by epic:

| Epic | Scope | Status |
|---|---|---|
| 1 — Quick-Start Token Generation (MVP) | CLI scaffold, quick-start flow, primitives, semantics, theming, preview, DTCG + CSS output, config | **Done** |
| 2 — Advanced Token Authoring | Advanced mode for core categories, `add` subcommand, component tokens | In progress |
| 3 — Token System Evolution | Re-entrant editing, diff display, dry-run, design-system changelog | Backlog |
| 4 — Multi-Platform Output | Figma Variables / Tokens Studio, iOS Swift, Android | Backlog |
| 5 — Design System Intelligence | `inspect` command, `migrate` command | Backlog |

See [`docs/planning/epics.md`](docs/planning/epics.md) for the full roadmap and [`docs/planning/sprint-status.yaml`](docs/planning/sprint-status.yaml) for per-story status.

## License

This project is licensed under the [MIT License](LICENSE).
