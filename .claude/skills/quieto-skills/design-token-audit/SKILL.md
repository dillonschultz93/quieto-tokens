---
name: design-token-audit
description: 'Inspect and health-check an existing design token system. Runs orphan detection, broken reference checks, naming validation, and WCAG contrast analysis, then summarizes findings. Use when the user wants to audit, lint, or validate their token system quality.'
---

# Design Token Audit

You are helping the user audit their design token system for quality issues.

## Prerequisites

Verify a token system exists in the current directory:

```bash
ls quieto.config.json tokens/
```

If no `quieto.config.json` or `tokens/` directory exists, tell the user to run `/design-token-init` first.

## Workflow

### 1. Run the inspect command

```bash
npx quieto-tokens inspect
```

This performs four analyses:
- **Orphan detection**: primitive tokens not referenced by any semantic token
- **Broken references**: semantic/component tokens pointing to non-existent primitives
- **Naming validation**: tokens that violate the DTCG naming conventions
- **WCAG contrast analysis**: foreground/background semantic color pairs checked against AA thresholds

### 2. Optionally write a markdown report

If the user wants a persistent report:

```bash
npx quieto-tokens inspect --output report.md
```

Then read and summarize the report:

```bash
cat report.md
```

### 3. Interpret results

Present findings to the user organized by severity:

**Critical** (must fix):
- Broken references — these will cause build failures or `undefined` CSS values
- WCAG contrast failures — accessibility violations

**Warning** (should fix):
- Orphaned primitives — unused tokens bloat the system
- Naming violations — inconsistency makes tokens harder to discover

### 4. Suggest fixes

For each issue category, suggest concrete actions:

- **Broken references**: identify which semantic token has the bad ref and what it should point to. Check if a primitive was renamed or removed.
- **Contrast failures**: suggest alternative step pairings from the color ramp that would pass AA. Use the formula: contrast ratio >= 4.5:1 for normal text, >= 3:1 for large text.
- **Orphans**: determine if the primitive should be wired into a semantic role or removed.
- **Naming violations**: show the expected naming pattern from the project's nomenclature (see `docs/qds/design-tokens-nomenclature.md`).

### 5. After fixing

If you help the user fix issues, re-run the audit to confirm a clean bill of health:

```bash
npx quieto-tokens inspect
```
