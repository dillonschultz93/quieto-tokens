import { normalizeHex } from "./color.js";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex);
  const stripped = normalized.slice(1);
  const r = parseInt(stripped.slice(0, 2), 16);
  const g = parseInt(stripped.slice(2, 4), 16);
  const b = parseInt(stripped.slice(4, 6), 16);
  return { r, g, b };
}

export function hexToAnsi(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m██\x1b[0m`;
}

function forceColorEnabled(): boolean {
  const fc = process.env.FORCE_COLOR;
  if (fc === undefined) return false;
  const s = String(fc).trim();
  return s !== "" && s !== "0" && s !== "false";
}

export function supportsColor(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  if (forceColorEnabled()) return true;
  if (!process.stdout.isTTY) return false;
  const ct = (process.env.COLORTERM ?? "").toLowerCase();
  if (ct === "truecolor" || ct === "24bit") return true;
  const term = (process.env.TERM ?? "").toLowerCase();
  return (
    term.includes("truecolor") ||
    term.includes("24bit") ||
    term.includes("kitty") ||
    term.includes("wezterm") ||
    term.includes("ghostty")
  );
}
