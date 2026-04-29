---
name: design-token-migrate
description: 'Scan a codebase for hardcoded CSS values (hex colors, pixel dimensions) that match existing design tokens, and optionally apply exact-match replacements. Use when the user wants to migrate a codebase from hardcoded values to token references.'
---

# Design Token Migrate

You are helping the user find and replace hardcoded values in their stylesheets with design token references.

## Prerequisites

Verify a token system exists:

```bash
ls quieto.config.json tokens/
```

If not found, tell the user to run `/design-token-init` first.

## Workflow

### 1. Identify the target directory

Ask the user which directory contains the stylesheets to scan. Common targets:
- `src/styles/`
- `src/components/`
- `src/`
- `app/`

The scanner looks at `.css`, `.scss`, `.sass`, `.less`, and `.styl` files. It automatically skips `node_modules`, `dist`, `build`, `coverage`, `.next`, and `.nuxt`.

### 2. Scan for hardcoded values

Run the scan first (read-only, no file modifications):

```bash
npx quieto-tokens migrate --scan <target-directory>
```

For example:

```bash
npx quieto-tokens migrate --scan src/styles
```

To save the report:

```bash
npx quieto-tokens migrate --scan src/styles --output migration-report.md
```

### 3. Review findings

Present the scan results to the user:

- **Total files scanned** and how many contained matches
- **Match list**: each match shows the file, line number, hardcoded value, suggested token replacement, and confidence level (`exact` or `approximate`)
- **Exact matches** are safe to auto-replace; **approximate matches** need human review

If a report file was generated, read it:

```bash
cat migration-report.md
```

### 4. Apply replacements (with user consent)

Only proceed to apply if the user explicitly agrees. The apply mode modifies files in-place.

**Important**: The CLI checks for uncommitted git changes and warns the user. Recommend committing or stashing first:

```bash
git status
```

Then apply:

```bash
npx quieto-tokens migrate --apply <target-directory>
```

For example:

```bash
npx quieto-tokens migrate --apply src/styles --output migration-report.md
```

### 5. Verify changes

After applying, help the user verify:

```bash
git diff
```

Suggest running `/design-token-audit` to confirm the token system itself is still healthy, and running any project test suite or build to catch regressions.
