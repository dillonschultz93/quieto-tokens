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
import { contrastRatio } from "@quieto/tokens";
const fg = "#4F46E5";
const bg = "#FFFFFF";
const ratio = contrastRatio(fg, bg);
const aa = ratio >= 4.5;
const aaLarge = ratio >= 3;
const aaa = ratio >= 7;
const aaaLarge = ratio >= 4.5;
console.log(JSON.stringify({
  ratio: ratio.toFixed(2),
  "AA normal (>=4.5:1)": aa,
  "AA large (>=3:1)": aaLarge,
  "AAA normal (>=7:1)": aaa,
  "AAA large (>=4.5:1)": aaaLarge
}, null, 2));
'
```

Replace the hex values with the user's colors. Present the results:
- **Contrast ratio**: X.XX:1
- **WCAG AA normal text** (>= 4.5:1): Pass/Fail
- **WCAG AA large text** (>= 3:1): Pass/Fail
- **WCAG AAA normal text** (>= 7:1): Pass/Fail
- **WCAG AAA large text** (>= 4.5:1): Pass/Fail

If it fails, suggest which direction to adjust (lighter background or darker foreground) and check adjacent ramp steps if the colors come from the token system.

### Mode B: Full system contrast audit

If the user wants to check all semantic color pairings in their token system, run the full inspect command — it includes contrast analysis:

```bash
npx quieto-tokens inspect
```

This command performs the full contrast audit across all semantic foreground/background pairings in every theme.

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
