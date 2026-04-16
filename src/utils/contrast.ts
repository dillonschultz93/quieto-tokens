import { hexToRgb } from "./color-display.js";

function linearize(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045
    ? srgb / 12.92
    : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const WCAG_AA_THRESHOLD = 4.5;

export function meetsWcagAA(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= WCAG_AA_THRESHOLD;
}

export function formatContrastResult(fg: string, bg: string): string {
  const ratio = contrastRatio(fg, bg);
  const rounded = Math.round(ratio * 10) / 10;
  const passes = ratio >= WCAG_AA_THRESHOLD;
  const mark = passes ? "✓" : "✗";
  return `${rounded}:1 ${mark} AA`;
}
