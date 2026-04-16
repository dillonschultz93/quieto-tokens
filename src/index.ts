export { initCommand } from "./commands/init.js";
export type { QuickStartOptions } from "./types.js";
export type { PrimitiveToken } from "./types/tokens.js";
export type { ColorPrimitive, ColorRamp } from "./generators/color.js";
export {
  generatePrimaryRamp,
  generateNeutralRamp,
  generateColorPrimitives,
} from "./generators/color.js";
export { runColorGeneration } from "./pipeline/color.js";
export {
  generateSpacingPrimitives,
  SPACING_RAMP_4,
  SPACING_RAMP_8,
} from "./generators/spacing.js";
export {
  generateTypographyPrimitives,
  FONT_WEIGHTS,
  TYPE_SCALE_COMPACT,
  TYPE_SCALE_BALANCED,
  TYPE_SCALE_SPACIOUS,
} from "./generators/typography.js";
export type { TypeScaleStep } from "./generators/typography.js";
export {
  runSpacingGeneration,
  runTypographyGeneration,
} from "./pipeline/spacing-typography.js";
