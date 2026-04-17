# Quieto Tokens

An open source CLI tool that walks developers through creating a complete design token system and outputs platform-specific artifacts. Built on the Quieto ecosystem: [`@quieto/engine`](https://www.npmjs.com/package/@quieto/engine) for color math and [`@quieto/palettes`](https://www.npmjs.com/package/@quieto/palettes) for accessible color ramp generation.

> Tailwind gives you someone else's design decisions. Quieto gives you your own.

## What It Does

Quieto Tokens generates a three-tier design token system (primitive, semantic, and component tokens) from a few simple inputs. The output is [DTCG](https://design-tokens.github.io/community-group/format/)-aligned JSON source files and platform-specific builds via [Style Dictionary v4](https://styledictionary.com/).

**Quick-start mode** asks 3-4 questions and generates a production-ready token set. **Advanced mode** gives full control over every category.

### Advanced mode

Reach for advanced mode when the quick-start defaults aren't enough — you want to add hue ramps beyond your primary brand color, tune individual spacing steps, or override specific font families, sizes, weights, line heights, or letter spacing. Launch it with:

```bash
quieto-tokens init --advanced
```

or, when you run `quieto-tokens init` on a fresh project, choose "Advanced" at the mode prompt. Running `quieto-tokens init` on a project that already has a `quieto.config.json` always routes through advanced mode under the "Modify existing system" option, with every prior answer pre-filled so you only adjust what's changing.

Each category (color → spacing → typography) is an independently skippable step; skipping keeps the quick-start defaults for that category. All choices are persisted into `quieto.config.json` under `advanced.<category>` so you can re-run and refine without starting over.

> **Don't hand-edit `tokens/*.json` or `build/*.css`.** They're tool-generated (note the `$metadata.doNotEdit` banner at the top of every file). Edit `quieto.config.json` and re-run `quieto-tokens init` instead.

### Token Tiers

- **Primitive** — Core values: color ramps, spacing scales, type scales. Obfuscation layer over raw values.
- **Semantic** — UI-meaningful assignments: `color.background.primary`, `spacing.md`, `typography.body`. References primitives.
- **Component** — Component-specific decisions: `button.primary.color.background.hover`. References semantics.

### Output Formats

- CSS custom properties (MVP)
- JSON for Figma Variables / Tokens Studio (planned)
- iOS Swift (planned)
- Android XML / Compose (planned)

## Key Features

- **Accessible by default** — All color tokens are WCAG AA compliant, enforced by `@quieto/palettes`
- **No framework lock-in** — Platform-native output that works with any framework
- **Light/dark themes** — Generated from a single yes/no question using the same primitive palette
- **Re-entrant editing** — Modify your token system without starting over
- **Design system changelog** — Automatic tracking of what changed and why
- **DTCG-aligned** — Interoperable with the growing design token tool ecosystem

## Status

This project is in active development. See [docs/planning/epics.md](docs/planning/epics.md) for the full roadmap.

## License

This project is licensed under the [MIT License](LICENSE).
