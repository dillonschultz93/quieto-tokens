# Quieto Skills

[Claude Code](https://claude.ai/code) skills for the [Quieto Tokens](https://github.com/dillonschultz93/quieto-tokens) design token CLI. Each skill wraps a CLI command into a conversational workflow invocable via slash command.

## Available Skills

| Skill | Command | What it does |
|---|---|---|
| **design-token-init** | `/design-token-init` | Scaffold a new token system interactively |
| **design-token-audit** | `/design-token-audit` | Health-check: orphans, broken refs, naming, WCAG contrast |
| **design-token-migrate** | `/design-token-migrate` | Scan stylesheets for hardcoded values and replace with tokens |
| **design-token-component** | `/design-token-component` | Generate tier-3 component tokens (button, card, etc.) |
| **design-token-category-add** | `/design-token-category-add` | Add shadow, border, or animation categories |
| **design-token-contrast** | `/design-token-contrast` | Ad-hoc or system-wide WCAG contrast checking |
| **design-token-update** | `/design-token-update` | Modify inputs (brand color, spacing, etc.) with diff preview |

## Installation

### Standalone

Copy the skill directories into your project's `.claude/skills/` directory:

```bash
cp -r design-token-* /path/to/your/project/.claude/skills/
```

### As a git subtree (recommended)

This keeps the skills in sync with this repo:

```bash
git subtree add --prefix=.claude/skills \
  git@github.com:dillonschultz93/quieto-skills.git main --squash
```

To pull updates later:

```bash
git subtree pull --prefix=.claude/skills \
  git@github.com:dillonschultz93/quieto-skills.git main --squash
```

To push local edits back upstream:

```bash
git subtree push --prefix=.claude/skills \
  git@github.com:dillonschultz93/quieto-skills.git main
```

## Prerequisites

These skills require [`@quieto/tokens`](https://www.npmjs.com/package/@quieto/tokens) to be installed in the target project:

```bash
npm install @quieto/tokens
```

## License

MIT
