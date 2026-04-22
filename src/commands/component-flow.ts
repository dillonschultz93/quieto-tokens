import * as p from "@clack/prompts";
import type { SemanticToken, PrimitiveToken } from "../types/tokens.js";
import type {
  ComponentTokenConfig,
  ComponentCell,
  ComponentCellState,
  ComponentProperty,
  ComponentState,
} from "../types/config.js";
import { validateComponentName } from "../utils/validation.js";

function handleCancel(
  value: unknown,
): asserts value is string | number | boolean | string[] {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    throw new Error("cancelled");
  }
}

const STANDARD_PROPERTIES: ComponentProperty[] = [
  "color-background",
  "color-content",
  "color-border",
  "spacing-padding",
  "border-radius",
  "typography",
];

const PROPERTY_LABELS: Record<ComponentProperty, string> = {
  "color-background": "Background color",
  "color-content": "Content/text color",
  "color-border": "Border color",
  "spacing-padding": "Padding",
  "border-radius": "Border radius",
  typography: "Typography",
};

const ALL_STATES: ComponentState[] = [
  "default",
  "hover",
  "active",
  "focus",
  "disabled",
];

const DTCG_CUSTOM_REF_RE = /^\{[a-z][a-z0-9.-]*\}$/;

function filterSemanticsByProperty(
  semanticTokens: SemanticToken[],
  property: ComponentProperty,
): SemanticToken[] {
  switch (property) {
    case "color-background":
      return semanticTokens.filter(
        (t) => t.path[0] === "color" && t.path[1] === "background",
      );
    case "color-content":
      return semanticTokens.filter(
        (t) => t.path[0] === "color" && t.path[1] === "content",
      );
    case "color-border":
      return semanticTokens.filter(
        (t) => t.path[0] === "color" && t.path[1] === "border",
      );
    case "spacing-padding":
      return semanticTokens.filter((t) => t.path[0] === "spacing");
    case "border-radius":
      return semanticTokens.filter(
        (t) => t.path[0] === "border" && t.path[1] === "radius",
      );
    case "typography":
      return getTypographyRoles(semanticTokens);
    default:
      return [];
  }
}

function getTypographyRoles(semanticTokens: SemanticToken[]): SemanticToken[] {
  const roleNames = new Set<string>();
  const roles: SemanticToken[] = [];
  for (const t of semanticTokens) {
    if (t.path[0] !== "typography") continue;
    const role = t.path[1];
    if (!role || roleNames.has(role)) continue;
    roleNames.add(role);
    roles.push({
      ...t,
      name: `typography.${role}`,
      path: ["typography", role],
    });
  }
  return roles;
}

function buildRefFromToken(token: SemanticToken): string {
  return `{${token.path.join(".")}}`;
}

function canResolveRef(
  ref: string,
  semanticTokens: SemanticToken[],
  primitives: PrimitiveToken[],
): boolean {
  const inner = ref.slice(1, -1);
  for (const t of semanticTokens) {
    if (t.path.join(".") === inner) return true;
  }
  for (const t of primitives) {
    if (t.path.join(".") === inner) return true;
  }
  return false;
}

async function collectVariants(
  prior: ComponentTokenConfig | undefined,
): Promise<string[]> {
  const defaultOnly = await p.confirm({
    message: "Use a single 'default' variant?",
    initialValue: prior ? prior.variants.length === 1 && prior.variants[0] === "default" : false,
  });
  handleCancel(defaultOnly);

  if (defaultOnly) return ["default"];

  const variantInput = await p.text({
    message: "Enter variant names (comma-separated, e.g., primary, secondary, tertiary):",
    placeholder: "primary, secondary",
    initialValue: prior?.variants.filter((v) => v !== "default").join(", "),
    validate: (value) => {
      const trimmed = (value ?? "").trim();
      if (!trimmed) return "At least one variant is required.";
      const names = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
      if (names.length === 0) return "At least one variant is required.";
      for (const name of names) {
        const err = validateComponentName(name);
        if (err) return `Variant "${name}": ${err}`;
      }
      return undefined;
    },
  });
  handleCancel(variantInput);

  return (variantInput as string)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function collectValueForCell(
  variant: string,
  property: ComponentProperty,
  state: ComponentState,
  filtered: SemanticToken[],
  allSemantics: SemanticToken[],
  primitives: PrimitiveToken[],
): Promise<string> {
  const options = filtered.map((t) => ({
    value: buildRefFromToken(t),
    label: t.path.join("."),
  }));
  options.push({ value: "__custom__", label: "Custom reference" });

  const label = `${variant} → ${property} → ${state}`;
  const selected = await p.select({
    message: `Value for ${label}:`,
    options,
  });
  handleCancel(selected);

  if (selected === "__custom__") {
    const customRef = await p.text({
      message: `Enter a DTCG reference for ${label}:`,
      placeholder: "{color.background.primary}",
      validate: (value) => {
        const trimmed = (value ?? "").trim();
        if (!DTCG_CUSTOM_REF_RE.test(trimmed)) {
          return 'Reference must match {token.path} format (e.g., {color.background.primary})';
        }
        if (!canResolveRef(trimmed, allSemantics, primitives)) {
          return `Reference ${trimmed} does not exist in the current token system`;
        }
        return undefined;
      },
    });
    handleCancel(customRef);
    return (customRef as string).trim();
  }

  return selected as string;
}

export async function collectComponentInputs(
  semanticTokens: SemanticToken[],
  primitives: PrimitiveToken[],
  name: string,
  prior: ComponentTokenConfig | undefined,
): Promise<ComponentTokenConfig> {
  p.log.step(`Configuring component: ${name}`);

  const variants = await collectVariants(prior);
  p.log.info(`Variants: ${variants.join(", ")}`);

  const cells: ComponentCell[] = [];

  for (const variant of variants) {
    p.log.step(`Variant: ${variant}`);

    for (const property of STANDARD_PROPERTIES) {
      if (property === "border-radius") {
        const hasBorderSemantics = semanticTokens.some(
          (t) => t.path[0] === "border" && t.path[1] === "radius",
        );
        if (!hasBorderSemantics) {
          p.log.warn(
            'Border category not configured; add it first with "quieto-tokens add border"',
          );
          continue;
        }
      }

      const include = await p.confirm({
        message: `Include ${PROPERTY_LABELS[property]} for variant "${variant}"?`,
        initialValue: true,
      });
      handleCancel(include);
      if (!include) continue;

      const states = await collectStates(variant, property);

      const filtered = filterSemanticsByProperty(semanticTokens, property);

      if (filtered.length === 0) {
        p.log.warn(
          `No semantic tokens found for ${property}. Skipping.`,
        );
        continue;
      }

      if (property === "spacing-padding") {
        const paddingMode = await p.select({
          message: `Padding for "${variant}": single value or four sides?`,
          options: [
            { value: "single", label: "Single value (uniform padding)" },
            { value: "four-sides", label: "Four sides (top, right, bottom, left)" },
          ],
        });
        handleCancel(paddingMode);

        const paddingShape = paddingMode as "single" | "four-sides";

        if (paddingShape === "four-sides") {
          const cellStates: ComponentCellState[] = [];
          for (const state of states) {
            const sides: Record<string, string> = {};
            for (const side of ["top", "right", "bottom", "left"] as const) {
              const ref = await collectValueForCell(
                variant,
                property,
                state,
                filtered,
                semanticTokens,
                primitives,
              );
              sides[side] = ref;
            }
            cellStates.push({
              state,
              value: sides as { top: string; right: string; bottom: string; left: string },
            });
          }
          cells.push({ variant, property, paddingShape, states: cellStates });
        } else {
          const cellStates = await collectStatesValues(
            variant,
            property,
            states,
            filtered,
            semanticTokens,
            primitives,
          );
          cells.push({ variant, property, paddingShape, states: cellStates });
        }
      } else if (property === "typography") {
        const cellStates: ComponentCellState[] = [];
        for (const state of states) {
          const ref = await collectValueForCell(
            variant,
            property,
            state,
            filtered,
            semanticTokens,
            primitives,
          );
          cellStates.push({ state, value: ref });
        }
        cells.push({ variant, property, states: cellStates });
      } else {
        const cellStates = await collectStatesValues(
          variant,
          property,
          states,
          filtered,
          semanticTokens,
          primitives,
        );
        cells.push({ variant, property, states: cellStates });
      }
    }
  }

  return { variants, cells };
}

async function collectStates(
  variant: string,
  property: ComponentProperty,
): Promise<ComponentState[]> {
  const selected = await p.multiselect({
    message: `States for "${variant}" → ${PROPERTY_LABELS[property]}:`,
    options: ALL_STATES.map((s) => ({
      value: s,
      label: s,
    })),
    required: true,
    initialValues: ["default"],
  });
  handleCancel(selected);

  const states = selected as ComponentState[];
  if (!states.includes("default")) {
    states.unshift("default");
  }
  return states;
}

async function collectStatesValues(
  variant: string,
  property: ComponentProperty,
  states: ComponentState[],
  filtered: SemanticToken[],
  allSemantics: SemanticToken[],
  primitives: PrimitiveToken[],
): Promise<ComponentCellState[]> {
  const cellStates: ComponentCellState[] = [];
  for (const state of states) {
    const ref = await collectValueForCell(
      variant,
      property,
      state,
      filtered,
      allSemantics,
      primitives,
    );
    cellStates.push({ state, value: ref });
  }
  return cellStates;
}
