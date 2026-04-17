import type { PrimitiveToken } from "../types/tokens.js";
import type { BorderCategoryConfig } from "../types/config.js";

/**
 * Emit `border.width.<px>` and `border.radius.<px>` primitives from the
 * user's integer arrays. When {@link BorderCategoryConfig.pill} is
 * `true` the largest radius entry emits `$value: "9999px"` regardless
 * of its literal; when `false` every entry emits its literal pixel
 * value.
 *
 * The generator deduplicates and sorts both arrays before emission
 * (two primitives with the same path would fail
 * `tokensToDtcgTree`'s duplicate-path check).
 */
export function generateBorderPrimitives(
  input: BorderCategoryConfig,
): PrimitiveToken[] {
  const widths = dedupeSorted(input.widths);
  const radii = dedupeSorted(input.radii);
  const wantsPill = input.pill === true && radii.length > 0;

  const tokens: PrimitiveToken[] = [];

  for (const width of widths) {
    tokens.push({
      tier: "primitive",
      category: "border",
      name: `border.width.${width}`,
      $type: "dimension",
      $value: `${width}px`,
      path: ["border", "width", String(width)],
    });
  }

  for (let i = 0; i < radii.length; i++) {
    const radius = radii[i]!;
    const isPillEntry = wantsPill && i === radii.length - 1;
    const pxValue = isPillEntry ? "9999px" : `${radius}px`;
    tokens.push({
      tier: "primitive",
      category: "border",
      name: `border.radius.${radius}`,
      $type: "dimension",
      $value: pxValue,
      path: ["border", "radius", String(radius)],
    });
  }

  return tokens;
}

function dedupeSorted(values: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of values) {
    if (!Number.isFinite(v) || !Number.isInteger(v) || v <= 0) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out.sort((a, b) => a - b);
}
