---
name: design-token-contrast
description: 'Check WCAG contrast ratios between color pairs or across your token system semantic foreground/background pairings. Use when the user wants to verify accessibility compliance for specific colors or their entire token palette.'
---

# Design Token Contrast Checker

You are helping the user check WCAG 2.1 color contrast compliance.

## Two modes

This skill works in two ways depending on what the user needs:

### Mode A: Ad-hoc color pair check

If the user provides two specific colors (e.g., "check contrast between #4F46E5 and #FFFFFF"), compute the contrast ratio directly using the project's utility functions.

Run this inline:

```bash
node --input-type=module -e '
import { contrastRatio, meetsWcagAA, hexToRgb, relativeLuminance } from "./dist/index.js";
const fg = hexToRgb("#4F46E5");
const bg = hexToRgb("#FFFFFF");
const fgL = relativeLuminance(fg.r, fg.g, fg.b);
const bgL = relativeLuminance(bg.r, bg.g, bg.b);
const ratio = contrastRatio(fgL, bgL);
const aa = meetsWcagAA(ratio, false);
const aaLarge = meetsWcagAA(ratio, true);
console.log(JSON.stringify({ ratio: ratio.toFixed(2), aa, aaLarge }, null, 2));
'
```

Replace the hex values with the user's colors. Present the results:
- **Contrast ratio**: X.XX:1
- **WCAG AA normal text** (>= 4.5:1): Pass/Fail
- **WCAG AA large text** (>= 3:1): Pass/Fail
- **WCAG AAA normal text** (>= 7:1): Pass/Fail

If it fails, suggest which direction to adjust (lighter background or darker foreground) and check adjacent ramp steps if the colors come from the token system.

### Mode B: Full system contrast audit

If the user wants to check all semantic color pairings in their token system, run the full inspect command — it includes contrast analysis:

```bash
npx quieto-tokens inspect
```

Or for just the contrast portion, use the programmatic API:

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";

// Load primitive and semantic tokens
const files = ["tokens/primitive/color.json", "tokens/semantic/color.json"];
for (const f of files) {
  try {
    const data = JSON.parse(readFileSync(f, "utf-8"));
    console.log(f, "loaded:", Object.keys(data).length, "top-level keys");
  } catch (e) {
    console.log(f, "not found");
  }
}
'
```

For a comprehensive audit, prefer the full inspect command and filter the output for contrast-specific findings.

## WCAG thresholds reference

| Level | Normal text | Large text (18pt+ or 14pt+ bold) |
|-------|------------|----------------------------------|
| AA    | 4.5:1      | 3:1                              |
| AAA   | 7:1        | 4.5:1                            |

## Suggesting fixes

When a pair fails contrast:
1. Identify which ramp step each color comes from
2. Suggest moving the foreground darker (higher step number) or the background lighter (lower step number)
3. Check the suggested replacement pair and confirm it passes before recommending
4. Note if the fix would break consistency with other semantic roles — suggest running `/design-token-audit` after any changes
