# Quieto Tokens

An open source CLI tool that walks developers through creating a complete design token system and outputs platform-specific artifacts. Built on the Quieto ecosystem: [`@quieto/engine`](https://www.npmjs.com/package/@quieto/engine) for color math and [`@quieto/palettes`](https://www.npmjs.com/package/@quieto/palettes) for accessible color ramp generation.

> Tailwind gives you someone else's design decisions. Quieto gives you your own.

## What It Does

Quieto Tokens generates a three-tier design token system (primitive, semantic, and component tokens) from a few simple inputs. The output is [DTCG](https://design-tokens.github.io/community-group/format/)-aligned JSON source files and platform-specific builds via [Style Dictionary v4](https://styledictionary.com/).

**Quick-start mode** asks 3-4 questions and generates a production-ready token set. **Advanced mode** gives full control over every category.

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
