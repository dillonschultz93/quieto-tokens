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

### npx (recommended)

```bash
npx @quieto/skills install
```

This installs all skills into `.claude/skills/` in your current directory. You can also specify a target directory:

```bash
npx @quieto/skills install /path/to/your/project
```

### Manual

Copy the skill directories into your project's `.claude/skills/` directory:

```bash
cp -r design-token-* /path/to/your/project/.claude/skills/
```

### As a git subtree

```bash
git subtree add --prefix=.claude/skills/quieto-skills \
  git@github.com:dillonschultz93/quieto-skills.git main --squash
```

## Prerequisites

These skills require [`@quieto/tokens`](https://www.npmjs.com/package/@quieto/tokens) to be installed in the target project:

```bash
npm install @quieto/tokens
```

## License

MIT
