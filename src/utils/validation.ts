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

const COMPONENT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const COMPONENT_NAME_MAX_LENGTH = 40;
const RESERVED_COMPONENT_NAMES: ReadonlySet<string> = new Set([
  "color",
  "spacing",
  "typography",
  "shadow",
  "border",
  "animation",
  "primitive",
  "semantic",
  "component",
  "default",
]);

export function validateComponentName(
  name: string | undefined,
): string | undefined {
  const trimmed = (name ?? "").trim();

  if (!trimmed) {
    return "A component name is required (e.g., button, text-field)";
  }

  if (trimmed.length > COMPONENT_NAME_MAX_LENGTH) {
    return `Component name must be ${COMPONENT_NAME_MAX_LENGTH} characters or fewer`;
  }

  if (!COMPONENT_NAME_PATTERN.test(trimmed)) {
    return "Component name must be lowercase kebab-case starting with a letter (e.g., button, dropdown-menu)";
  }

  if (RESERVED_COMPONENT_NAMES.has(trimmed)) {
    return `"${trimmed}" is a reserved name and cannot be used as a component name`;
  }

  return undefined;
}
