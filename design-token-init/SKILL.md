---
name: design-token-init
description: 'Scaffold a new design token system interactively. Guides the user through brand color, spacing base, type scale, and dark mode choices, then runs `quieto-tokens init` to generate a complete DTCG token system with multi-platform outputs (CSS, Figma, iOS, Android). Use when the user wants to create or bootstrap a new token system.'
---

# Design Token Init

You are helping the user scaffold a new design token system using `@quieto/tokens`.

## Prerequisites

Before running anything, verify the CLI is available:

```bash
npx quieto-tokens --version
```

If this fails, tell the user to install the package first (`npm install @quieto/tokens`).

## Workflow

### 1. Gather intent

Ask the user what they need. The key inputs are:

- **Brand color**: a hex color (e.g. `#4F46E5`). This seeds the primary color ramp.
- **Spacing base**: `4` or `8` (pixel unit). Determines the spacing scale.
- **Type scale**: `compact`, `balanced`, or `spacious`. Controls font-size progression.
- **Dark mode**: whether to generate both light and dark themes.
- **Advanced mode**: whether to customize individual tokens per category (additional hues, custom spacing steps, typography overrides).
- **Output platforms**: CSS is always included. Optionally: Figma JSON, iOS Swift, Android (XML or Compose).

If the user already stated preferences (e.g. "set up tokens with brand color #E11D48"), extract what you can and confirm the rest with sensible defaults.

### 2. Run the CLI

Execute the init command:

```bash
npx quieto-tokens init
```

Or with advanced mode:

```bash
npx quieto-tokens init --advanced
```

Use `--dry-run` first if the user wants to preview without writing files:

```bash
npx quieto-tokens init --dry-run
```

The CLI is interactive (uses `@clack/prompts`), so it will prompt for each input. Since the CLI requires interactive terminal input, tell the user to run this command themselves using `!` prefix:

```
! npx quieto-tokens init
```

### 3. Verify output

After init completes, check what was generated:

```bash
ls tokens/
ls build/
cat quieto.config.json
```

Summarize the generated token system for the user:
- Number of tokens per tier (primitive, semantic, component)
- Categories included (color, spacing, typography)
- Output platforms configured
- Whether dark mode was generated

### 4. Next steps

Suggest logical follow-ups:
- Run `/design-token-audit` to verify the system health
- Use `/design-token-category-add` to add shadow, border, or animation tokens
- Use `/design-token-component` to generate component-level tokens
- Run `/design-token-migrate` to scan existing CSS for hardcoded values to replace
