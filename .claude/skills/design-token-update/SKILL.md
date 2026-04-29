---
name: design-token-update
description: 'Modify specific token categories in an existing system without regenerating everything. Preview what changed via a diff before writing. Use when the user wants to change their brand color, spacing base, type scale, or other inputs and see the impact.'
---

# Design Token Update

You are helping the user modify their existing token system and preview the changes.

## Prerequisites

Verify a token system and config exist:

```bash
ls quieto.config.json tokens/
```

If not found, tell the user to run `/design-token-init` first.

Read the current config to understand what's configured:

```bash
cat quieto.config.json
```

## Workflow

### 1. Understand what the user wants to change

Common update scenarios:
- **Brand color change**: "change my brand color from #4F46E5 to #E11D48"
- **Spacing base change**: switch from 4px to 8px base (or vice versa)
- **Type scale change**: switch between compact, balanced, or spacious
- **Dark mode toggle**: add or remove dark theme generation
- **Override adjustments**: modify semantic token overrides

### 2. Preview with dry-run first

Always preview changes before writing:

```bash
npx quieto-tokens update --dry-run
```

The update command is interactive — it lets the user select which categories to modify and shows a diff of what would change. Since it requires terminal input, tell the user to run it:

```
! npx quieto-tokens update --dry-run
```

### 3. Apply the update

Once the user is satisfied with the preview:

```
! npx quieto-tokens update
```

### 4. Review the diff

After the update completes, show what changed on disk:

```bash
git diff tokens/
git diff build/
git diff quieto.config.json
```

Summarize the changes:
- Which token values changed
- How many tokens were affected
- Whether any semantic mappings shifted
- If themes were regenerated

### 5. Validate

Run the audit to ensure the update didn't introduce issues:

```bash
npx quieto-tokens inspect
```

If the user has component tokens, verify their references are still valid — a brand color change cascades through the semantic layer but component refs should remain stable since they point to semantic names, not primitive values.

### 6. Suggest follow-ups

- If the user changed colors, suggest running `/design-token-contrast` to verify AA compliance with the new palette
- If the change affects a live project, suggest running `/design-token-migrate` to catch any hardcoded values that should use the updated tokens
