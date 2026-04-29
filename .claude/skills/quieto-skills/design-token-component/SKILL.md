---
name: design-token-component
description: 'Generate tier-3 component tokens for a named UI component (e.g., button, modal, card). Walks through variants, states, and property assignments interactively. Use when the user wants to create component-level tokens that reference their semantic tokens.'
---

# Design Token Component Builder

You are helping the user generate tier-3 component tokens that reference their existing semantic token system.

## Prerequisites

Verify a token system exists with semantic tokens:

```bash
ls quieto.config.json tokens/semantic/
```

If not found, tell the user to run `/design-token-init` first.

## Background

Component tokens are the third tier in the token hierarchy:
1. **Primitive** — raw values (`color.blue.500 = #4F46E5`)
2. **Semantic** — role-based references (`color.background.primary = {color.blue.500}`)
3. **Component** — component-scoped references (`button.color.background.default = {color.background.primary}`)

Component tokens enable per-component theming and state management without modifying the semantic layer.

## Workflow

### 1. Determine the component name

Ask the user what component to tokenize. Common examples: `button`, `card`, `modal`, `input`, `badge`, `alert`, `tooltip`.

The name must be lowercase, alphanumeric, and may contain hyphens. No spaces or special characters.

### 2. Run the component command

The CLI is interactive and walks through variant/state/property assignment. Since it requires terminal input, tell the user to run it themselves:

```
! npx quieto-tokens component <name>
```

For example:

```
! npx quieto-tokens component button
```

Use `--dry-run` to preview without writing:

```
! npx quieto-tokens component button --dry-run
```

The interactive flow will ask:
- **Variants**: e.g., `primary`, `secondary`, `ghost` for a button
- **Properties per variant**: color-background, color-content, color-border, spacing-padding, border-radius, typography
- **States per property**: default, hover, active, focus, disabled
- **Token reference for each cell**: which semantic token to point to

### 3. Verify output

After generation, check the created files:

```bash
ls tokens/component/
cat tokens/component/<name>.json
```

Also check that the config was updated:

```bash
cat quieto.config.json | grep -A 20 '"components"'
```

### 4. Rebuild outputs

The component command automatically rebuilds, but verify the CSS was emitted:

```bash
grep "<name>" build/tokens.css | head -20
```

### 5. Suggest follow-ups

- Run `/design-token-audit` to verify no broken references were introduced
- Generate more components as needed
- If the user needs to modify an existing component's tokens, they can re-run the command — it will update the existing config
