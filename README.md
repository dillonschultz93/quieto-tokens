# Quieto Tokens

An open source CLI tool that walks developers through creating a complete design token system and outputs platform-specific artifacts. Built on [`@quieto/engine`](https://www.npmjs.com/package/@quieto/engine) for color math and accessible color ramp generation.

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
  tokens.figma.json       # Optional — Figma Variables / Tokens Studio import
  ios/
    Color.swift             # Optional — UIColor + SwiftUI Color extensions
    Spacing.swift           # Optional — CGFloat spacing constants
    Typography.swift        # Optional — Font size / weight / family constants
  android/                  # Optional — XML in values/ or Jetpack Compose Kotlin
    values/…                #   Resource XML, values-night/ when light + dark
    #   or Color.kt, Spacing.kt, Typography.kt (+ theme bridges)
quieto.config.json        # Your answers, so you can re-run to modify
```

When `quieto.config.json` includes `"outputs": ["css", "figma"]` (set during `init` or by editing the file), the CLI also writes **`build/tokens.figma.json`**: a nested, DTCG-shaped JSON file with one top-level key per theme (`default`, or `light` and `dark`, etc.). Token paths use `/` as the segment separator (Figma group style). Import that file into [Tokens Studio](https://tokens.studio/) or a Variables workflow; there is no Figma API integration — it is a static build artifact, like the CSS.

When `outputs` includes `"ios"`, the CLI writes Swift source files to **`build/ios/`**: `Color.swift` (UIColor static constants + SwiftUI Color extensions), `Spacing.swift` (CGFloat constants), and `Typography.swift` (font size, weight, and family constants). For multi-theme systems, tokens are organized under `Theme.Light` / `Theme.Dark` enums. These are raw `.swift` files — copy or reference them in your Xcode project.

When `outputs` includes `"android"`, the CLI also writes to **`build/android/`**. The format is selected at `init` and stored in `quieto.config.json` as **`androidFormat`**: `"xml"` (default) emits `values/colors.xml`, `values/dimens.xml`, and typography resource files, with `values-night/` for dark-theme overrides when you have both light and dark; **`"compose"`** emits `Color.kt`, `Spacing.kt`, and `Typography.kt` with Compose-friendly constants (and a Material3 `ColorScheme` bridge in multi-theme runs). This is a static file drop — it does not add Gradle or wire into your app build for you.

### Design System Changelog

After every successful write, the CLI also creates or updates **`TOKENS_CHANGELOG.md`** in the same directory as `quieto.config.json` (the project root). The file is ordinary Markdown with a fixed structure: a title line (`# Design System Changelog`), then entries in **newest-first** order, each under a `## [ISO-8601 timestamp]` heading, with `**Tool version:**`, `**Command:**`, `**Categories affected:**`, and a `### Summary` body. The summary captures what changed in human-readable form (token counts, cascade highlights, and, for `update` runs, relevant input changes such as a brand color swap).

`init`, `update`, `add`, and `component` all append a changelog entry when they persist tokens and config. **Dry run** and failed writes do not modify the file. A changelog write that fails (for example read-only media) is reported with a warning and does not roll back a successful token generation; you can commit `TOKENS_CHANGELOG.md` with your token changes to share a tool-level history alongside Git.

Running `quieto-tokens init` again on a project that already has `quieto.config.json` routes through a "Modify existing system" flow with your prior answers pre-filled — you only adjust what's changing.

### Dry run

Add **`--dry-run`** to any command (`init`, `update`, `add`, `component`) to run the full pipeline — prompts, generation, diff (for `update`), and the token preview with the override editor — without writing DTCG JSON, built CSS, or `quieto.config.json`. The tool also accepts `--dry-run=true` and `--dry-run=false` for scripts. In dry run, when the pipeline would otherwise save files, it logs that writes are skipped and ends with a confirmation that nothing was written.

### Updating your token system

Use **`quieto-tokens update`** when you only want to change one area (for example spacing or an add-on category) without re-running the full `init` pipeline for every category. The command loads `quieto.config.json`, lets you pick which categories to edit, and regenerates **only** those categories’ primitives (and rebuilds semantics from the merged primitive set). It then **shows a terminal diff** of what changed (primitives and semantics, grouped, with color swatches when the terminal supports them) plus a short cascade summary, and asks what to do next: write the change, open the full preview with the override loop, go back to pick more categories, or cancel. When you write, it updates JSON for the categories you changed and rebuilds CSS from the full on-disk tree. Unchanged category files keep their previous mtimes. If nothing actually changed from what is already on disk, it reports that and exits without writing.

By contrast, **`quieto-tokens init` → Modify existing system** remains the path for a full regeneration of all core categories in one pass.

### Advanced mode

Reach for advanced mode when the quick-start defaults aren't enough — you want to add hue ramps beyond your primary brand color, tune individual spacing steps, or override specific font families, sizes, weights, line heights, or letter spacing. Launch it with:

```bash
quieto-tokens init --advanced
```

or, when you run `quieto-tokens init` on a fresh project, choose "Advanced" at the mode prompt. Running `quieto-tokens init` on a project that already has a `quieto.config.json` always routes through advanced mode under the "Modify existing system" option, with every prior answer pre-filled so you only adjust what's changing.

Each category (color → spacing → typography) is an independently skippable step; skipping keeps the quick-start defaults for that category. All choices are persisted into `quieto.config.json` under `advanced.<category>` so you can re-run and refine without starting over.

> **Don't hand-edit `tokens/*.json` or `build/*.css`.** They're tool-generated (note the `$metadata.doNotEdit` banner at the top of every file). Edit `quieto.config.json` and re-run **`quieto-tokens update`** for targeted changes, or **`quieto-tokens init`** for a full pass.

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

### Component tokens

Once you have a semantic token system in place, use `component` to create tier-3 tokens that reference your semantics:

```bash
quieto-tokens component button
quieto-tokens component modal
quieto-tokens component text-field
```

Each invocation walks you through:
1. **Variants** — e.g., `primary`, `secondary`, `tertiary` (or a single `default` variant)
2. **Properties** — which of `color-background`, `color-content`, `color-border`, `spacing-padding`, `border-radius`, `typography` each variant needs
3. **States** — `default`, `hover`, `active`, `focus`, `disabled` per property
4. **Values** — pick from your available semantic tokens, or supply a custom DTCG reference

Output lands in `tokens/component/<name>.json` and CSS is rebuilt to include the new tokens:

```css
/* Example usage */
.btn-primary {
  background: var(--quieto-component-button-primary-color-background);
  color: var(--quieto-component-button-primary-color-content);
}
.btn-primary:hover {
  background: var(--quieto-component-button-primary-color-background-hover);
}
```

Component tokens are theme-agnostic at the JSON level — theming is delegated to the CSS cascade via the semantic token references they point at. Re-running `component button` prompts for confirmation before replacing the existing tokens.

### Inspecting your token system

Run **`quieto-tokens inspect`** to analyze your token system's health without modifying any files. The command loads all DTCG JSON source files and produces a terminal report covering:

- **Summary** — total tokens by tier (primitive, semantic, component), by category, and theme count.
- **Orphaned primitives** — primitive tokens not referenced by any semantic or component token.
- **Broken references** — semantic or component tokens whose `{...}` references point to non-existent tokens.
- **Naming violations** — token paths that don't follow the lowercase-hyphen naming convention.
- **WCAG contrast** — contrast ratios for paired background/content semantic color tokens, with pass/fail against WCAG AA (4.5:1).

Add `--output report.md` (or `-o report.md`) to write the report to a markdown file in addition to the terminal display.

```bash
quieto-tokens inspect                    # terminal report only
quieto-tokens inspect --output report.md # also write markdown
```

### Migrating hardcoded values to tokens

Once you have a token system, run **`quieto-tokens migrate`** to scan a codebase for hardcoded hex colors and spacing/typography dimensions that match your tokens.

Scan mode is read-only:

```bash
quieto-tokens migrate --scan ./src
quieto-tokens migrate --scan ./src --output migration-report.md
```

Apply mode performs **exact-match** replacements only (approximate matches are reported for manual review). Before modifying a file, the tool writes a one-time backup alongside it as **`<file>.quieto-bak`**.

```bash
quieto-tokens migrate --apply ./src
quieto-tokens migrate --apply ./src --output migration-report.md
```

### Token Tiers

- **Primitive** — Core values: color ramps, spacing scales, type scales. Obfuscation layer over raw values. _(shipped)_
- **Semantic** — UI-meaningful assignments: `color.background.primary`, `spacing.md`, `typography.body`. References primitives. _(shipped)_
- **Component** — Component-specific decisions: `button.primary.color.background.hover`. References semantics. _(shipped)_

### Color Ramps

Every color hue is generated as a **10-step ramp** using the industry-standard labeling convention:

| Step | Role |
|---|---|
| `50` | Lightest — page backgrounds, subtle surfaces |
| `100`–`400` | Light to mid tones — hover states, soft fills, muted content |
| `500` | Base — typically the seed color, used for primary surfaces |
| `600`–`800` | Mid to dark tones — emphasis, active states, borders |
| `900` | Darkest — strong content, dark-theme backgrounds |

This matches Tailwind, Radix, and Material conventions, so Quieto-generated tokens drop into existing design systems predictably. All steps are WCAG AA–compliant against their intended usage context, enforced structurally by `@quieto/engine`.

### Output Formats

- CSS custom properties _(shipped)_
- DTCG JSON source tokens _(shipped)_
- JSON for Figma Variables / Tokens Studio _(shipped)_
- iOS Swift (UIColor, SwiftUI Color, CGFloat, font constants) _(shipped)_
- Android XML / Compose _(shipped)_

## Key Features

- **Accessible by default** — All color tokens are WCAG AA compliant, enforced by `@quieto/engine`
- **No framework lock-in** — Platform-native output that works with any framework
- **Light/dark themes** — Generated from a single yes/no question using the same primitive palette
- **Selective updates** — `quieto-tokens update` re-runs only the categories you change, then shows a **terminal diff** (with cascade context) before you write
- **Dry-run mode** — Add `--dry-run` to run without writing files
- **Design system changelog** — Automatic tracking of what the tool last wrote to disk (`TOKENS_CHANGELOG.md`)
- **Design system intelligence** — `inspect` (token health) and `migrate` (adoption scanning + exact-match apply)
- **DTCG-aligned** — Interoperable with the growing design token tool ecosystem

## Status

This project is in active development. Progress by epic:

| Epic | Scope | Status |
|---|---|---|
| 1 — Quick-Start Token Generation (MVP) | CLI scaffold, quick-start flow, primitives, semantics, theming, preview, DTCG + CSS output, config | **Done** |
| 2 — Advanced Token Authoring | Advanced mode for core categories, `add` subcommand, component tokens | **Done** |
| 3 — Token System Evolution | `update` (re-entrant editing, selective regen), token diff in the terminal, dry-run, design-system changelog | **Done** |
| 4 — Multi-Platform Output | Figma Variables / Tokens Studio, iOS Swift, Android | **Done** |
| 5 — Design System Intelligence | `inspect` command, `migrate` command | **Done** |

See [`docs/planning/epics.md`](docs/planning/epics.md) for the full roadmap and [`docs/planning/sprint-status.yaml`](docs/planning/sprint-status.yaml) for per-story status.

## Contributing

Contributions are welcome! Check out the [contributing guide](CONTRIBUTING.md) to get started — it covers setup, development workflow, commit conventions, and how to submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).
