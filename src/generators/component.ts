import type { ComponentToken, PrimitiveToken, SemanticToken } from "../types/tokens.js";
import type {
  ComponentTokenConfig,
  ComponentCell,
  ComponentCellState,
} from "../types/config.js";

const PROPERTY_SEGMENTS: Record<string, string[]> = {
  "color-background": ["color", "background"],
  "color-content": ["color", "content"],
  "color-border": ["color", "border"],
  "border-radius": ["border", "radius"],
};

const DTCG_REF_PATTERN = /^\{([^}]+)\}$/;

function resolveRefType(
  ref: string,
  semanticTokens: SemanticToken[],
  primitives: PrimitiveToken[],
): string {
  const match = ref.match(DTCG_REF_PATTERN);
  if (!match) {
    throw new Error(`Invalid reference format: ${ref}`);
  }
  const refPath = match[1]!;

  for (const token of semanticTokens) {
    if (token.name === refPath || token.path.join(".") === refPath) {
      return token.$type;
    }
  }
  for (const token of primitives) {
    if (token.name === refPath || token.path.join(".") === refPath) {
      return token.$type;
    }
  }

  throw new Error(`Unresolved reference: ${ref}`);
}

function buildTokensForCell(
  componentName: string,
  cell: ComponentCell,
  semanticTokens: SemanticToken[],
  primitives: PrimitiveToken[],
): ComponentToken[] {
  const tokens: ComponentToken[] = [];

  for (const stateEntry of cell.states) {
    if (cell.property === "spacing-padding" && cell.paddingShape === "four-sides") {
      tokens.push(
        ...buildFourSidesPaddingTokens(
          componentName,
          cell.variant,
          stateEntry,
          semanticTokens,
          primitives,
        ),
      );
    } else if (cell.property === "typography") {
      tokens.push(
        ...buildTypographyTokens(
          componentName,
          cell.variant,
          stateEntry,
          semanticTokens,
          primitives,
        ),
      );
    } else {
      const segments = cell.property === "spacing-padding"
        ? ["spacing", "padding"]
        : PROPERTY_SEGMENTS[cell.property]!;
      const ref = stateEntry.value as string;
      const path = [componentName, cell.variant, ...segments, stateEntry.state];

      tokens.push({
        tier: "component",
        category: "component",
        componentName,
        name: path.join("."),
        $type: resolveRefType(ref, semanticTokens, primitives),
        $value: ref,
        path,
      });
    }
  }

  return tokens;
}

function buildFourSidesPaddingTokens(
  componentName: string,
  variant: string,
  stateEntry: ComponentCellState,
  semanticTokens: SemanticToken[],
  primitives: PrimitiveToken[],
): ComponentToken[] {
  const sides = stateEntry.value as {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };

  return (["top", "right", "bottom", "left"] as const).map((side) => {
    const ref = sides[side];
    const path = [
      componentName,
      variant,
      "spacing",
      "padding",
      side,
      stateEntry.state,
    ];
    return {
      tier: "component" as const,
      category: "component",
      componentName,
      name: path.join("."),
      $type: resolveRefType(ref, semanticTokens, primitives),
      $value: ref,
      path,
    };
  });
}

function buildTypographyTokens(
  componentName: string,
  variant: string,
  stateEntry: ComponentCellState,
  semanticTokens: SemanticToken[],
  primitives: PrimitiveToken[],
): ComponentToken[] {
  const ref = stateEntry.value as string;

  const match = ref.match(DTCG_REF_PATTERN);
  if (!match) throw new Error(`Invalid reference format: ${ref}`);
  const refBase = match[1]!;

  const fontSizeRef = `{${refBase}.font-size}`;
  const fontWeightRef = `{${refBase}.font-weight}`;

  const fontSizePath = [
    componentName,
    variant,
    "typography",
    "font-size",
    stateEntry.state,
  ];
  const fontWeightPath = [
    componentName,
    variant,
    "typography",
    "font-weight",
    stateEntry.state,
  ];

  return [
    {
      tier: "component" as const,
      category: "component",
      componentName,
      name: fontSizePath.join("."),
      $type: resolveRefType(fontSizeRef, semanticTokens, primitives),
      $value: fontSizeRef,
      path: fontSizePath,
    },
    {
      tier: "component" as const,
      category: "component",
      componentName,
      name: fontWeightPath.join("."),
      $type: resolveRefType(fontWeightRef, semanticTokens, primitives),
      $value: fontWeightRef,
      path: fontWeightPath,
    },
  ];
}

export function generateComponentTokens(
  componentName: string,
  input: ComponentTokenConfig,
  semanticTokens: SemanticToken[],
  primitives: PrimitiveToken[],
): ComponentToken[] {
  const tokens: ComponentToken[] = [];

  for (const cell of input.cells) {
    tokens.push(
      ...buildTokensForCell(componentName, cell, semanticTokens, primitives),
    );
  }

  return tokens;
}
