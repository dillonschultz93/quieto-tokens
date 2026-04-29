---
name: design-token-category-add
description: 'Add a new token category (shadow, border, or animation) to an existing token system. Prompts for category-specific inputs and generates the token files. Use when the user wants to extend their token system beyond color, spacing, and typography.'
---

# Design Token Category Add

You are helping the user extend their token system with additional categories.

## Prerequisites

Verify a token system exists:

```bash
ls quieto.config.json tokens/
```

If not found, tell the user to run `/design-token-init` first.

Check which categories are already configured:

```bash
cat quieto.config.json | grep -A 5 '"categories"'
```

The core categories (`color`, `spacing`, `typography`) are always present after init. The addable categories are:
- **shadow** — elevation/depth tokens (box-shadow)
- **border** — width and radius tokens
- **animation** — duration and easing tokens

## Workflow

### 1. Determine which category to add

If the user specified one, confirm it. If not, ask which they'd like. Explain what each provides:

- **Shadow**: generates elevation levels (1-6) with configurable color reference, blur/spread profile (soft or hard). Produces `box-shadow` composite tokens.
- **Border**: generates width steps and radius steps with an optional pill (9999px) marker. Produces `dimension` tokens for border-width and border-radius.
- **Animation**: generates duration steps and an easing curve preset (standard, emphasized, or decelerated). Produces `duration` and `cubicBezier` tokens.

### 2. Run the add command

The CLI is interactive for category-specific inputs. Tell the user to run it:

```
! npx quieto-tokens add <category>
```

For example:

```
! npx quieto-tokens add shadow
```

Or without specifying a category (the CLI will present a menu):

```
! npx quieto-tokens add
```

Use `--dry-run` to preview:

```
! npx quieto-tokens add shadow --dry-run
```

### 3. Category-specific inputs

**Shadow** will ask for:
- Number of elevation levels (2-6)
- Shadow color reference (a DTCG ref like `{color.neutral.900}`)
- Profile: `soft` (airy, larger blur) or `hard` (crisp, tight blur)

**Border** will ask for:
- Width steps (pixel values, e.g., 1, 2, 4)
- Radius steps (pixel values, e.g., 2, 4, 8, 16)
- Whether to include a pill radius (9999px for fully rounded elements)

**Animation** will ask for:
- Duration steps (milliseconds, e.g., 100, 200, 300, 500)
- Easing preset: `standard`, `emphasized`, or `decelerated`

### 4. Verify output

Check the new token files and updated config:

```bash
ls tokens/primitive/
cat quieto.config.json | grep -A 5 '"categories"'
```

### 5. Suggest follow-ups

- Run `/design-token-audit` to verify the new tokens are healthy
- Use `/design-token-component` to wire the new category into component tokens
- Add another category if needed
