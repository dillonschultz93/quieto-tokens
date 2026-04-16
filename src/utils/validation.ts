const HEX_PATTERN = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function validateHexColor(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return "Please enter a hex color value (e.g., #5B21B6 or 5B21B6)";
  }

  if (!HEX_PATTERN.test(trimmed)) {
    return "Invalid hex color. Use 3 or 6 hex digits, e.g. #5B21B6 or f00";
  }

  return undefined;
}
