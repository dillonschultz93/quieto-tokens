const HEX_3 = /^[0-9a-fA-F]{3}$/;
const HEX_6 = /^[0-9a-fA-F]{6}$/;

export function normalizeHex(value: string): string {
  const stripped = value.startsWith("#") ? value.slice(1) : value;

  if (HEX_3.test(stripped)) {
    const expanded = stripped
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }

  if (HEX_6.test(stripped)) {
    return `#${stripped.toUpperCase()}`;
  }

  throw new Error(`Invalid hex color: ${value}`);
}
