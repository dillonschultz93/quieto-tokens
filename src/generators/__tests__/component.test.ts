import { describe, it, expect } from "vitest";
import { generateComponentTokens } from "../component.js";
import type { SemanticToken, PrimitiveToken } from "../../types/tokens.js";
import type { ComponentTokenConfig } from "../../types/config.js";

const SEMANTIC_TOKENS: SemanticToken[] = [
  {
    tier: "semantic",
    category: "color",
    name: "color.background.primary",
    $type: "color",
    $value: "{color.blue.500}",
    path: ["color", "background", "primary"],
  },
  {
    tier: "semantic",
    category: "color",
    name: "color.background.secondary",
    $type: "color",
    $value: "{color.neutral.100}",
    path: ["color", "background", "secondary"],
  },
  {
    tier: "semantic",
    category: "color",
    name: "color.content.primary",
    $type: "color",
    $value: "{color.neutral.900}",
    path: ["color", "content", "primary"],
  },
  {
    tier: "semantic",
    category: "color",
    name: "color.border.default",
    $type: "color",
    $value: "{color.neutral.200}",
    path: ["color", "border", "default"],
  },
  {
    tier: "semantic",
    category: "spacing",
    name: "spacing.md",
    $type: "dimension",
    $value: "{spacing.space-16}",
    path: ["spacing", "md"],
  },
  {
    tier: "semantic",
    category: "spacing",
    name: "spacing.sm",
    $type: "dimension",
    $value: "{spacing.space-8}",
    path: ["spacing", "sm"],
  },
  {
    tier: "semantic",
    category: "border",
    name: "border.radius.md",
    $type: "dimension",
    $value: "{border.radius.4}",
    path: ["border", "radius", "md"],
  },
  {
    tier: "semantic",
    category: "typography",
    name: "typography.body.font-size",
    $type: "dimension",
    $value: "16px",
    path: ["typography", "body", "font-size"],
  },
  {
    tier: "semantic",
    category: "typography",
    name: "typography.body.font-weight",
    $type: "fontWeight",
    $value: "400",
    path: ["typography", "body", "font-weight"],
  },
];

const PRIMITIVES: PrimitiveToken[] = [
  {
    tier: "primitive",
    category: "color",
    name: "color.blue.500",
    $type: "color",
    $value: "#3B82F6",
    path: ["color", "blue", "500"],
  },
];

describe("generateComponentTokens", () => {
  it("generates tokens with correct path shape for a simple color-background cell", () => {
    const input: ComponentTokenConfig = {
      variants: ["primary"],
      cells: [
        {
          variant: "primary",
          property: "color-background",
          states: [
            { state: "default", value: "{color.background.primary}" },
          ],
        },
      ],
    };

    const tokens = generateComponentTokens(
      "button",
      input,
      SEMANTIC_TOKENS,
      PRIMITIVES,
    );

    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({
      tier: "component",
      category: "component",
      componentName: "button",
      name: "button.primary.color.background.default",
      $type: "color",
      $value: "{color.background.primary}",
      path: ["button", "primary", "color", "background", "default"],
    });
  });

  it("includes default state in path (CSS name transform strips it)", () => {
    const input: ComponentTokenConfig = {
      variants: ["primary"],
      cells: [
        {
          variant: "primary",
          property: "color-background",
          states: [
            { state: "default", value: "{color.background.primary}" },
          ],
        },
      ],
    };

    const tokens = generateComponentTokens("button", input, SEMANTIC_TOKENS, PRIMITIVES);
    expect(tokens[0]!.path).toContain("default");
    expect(tokens[0]!.name).toContain("default");
  });

  it("includes non-default states in the path alongside default", () => {
    const input: ComponentTokenConfig = {
      variants: ["primary"],
      cells: [
        {
          variant: "primary",
          property: "color-background",
          states: [
            { state: "default", value: "{color.background.primary}" },
            { state: "hover", value: "{color.background.secondary}" },
          ],
        },
      ],
    };

    const tokens = generateComponentTokens("button", input, SEMANTIC_TOKENS, PRIMITIVES);
    expect(tokens).toHaveLength(2);

    const defaultToken = tokens.find((t) => t.path.includes("default"))!;
    const hoverToken = tokens.find((t) => t.path.includes("hover"))!;

    expect(defaultToken.path).toEqual(["button", "primary", "color", "background", "default"]);
    expect(hoverToken.path).toEqual(["button", "primary", "color", "background", "hover"]);
  });

  it("expands typography into font-size + font-weight tokens", () => {
    const input: ComponentTokenConfig = {
      variants: ["primary"],
      cells: [
        {
          variant: "primary",
          property: "typography",
          states: [
            { state: "default", value: "{typography.body}" },
          ],
        },
      ],
    };

    const tokens = generateComponentTokens("button", input, SEMANTIC_TOKENS, PRIMITIVES);
    expect(tokens).toHaveLength(2);

    const fontSizeToken = tokens.find((t) => t.path.includes("font-size"))!;
    const fontWeightToken = tokens.find((t) => t.path.includes("font-weight"))!;

    expect(fontSizeToken.path).toEqual(["button", "primary", "typography", "font-size", "default"]);
    expect(fontSizeToken.$value).toBe("{typography.body.font-size}");
    expect(fontSizeToken.$type).toBe("dimension");

    expect(fontWeightToken.path).toEqual(["button", "primary", "typography", "font-weight", "default"]);
    expect(fontWeightToken.$value).toBe("{typography.body.font-weight}");
    expect(fontWeightToken.$type).toBe("fontWeight");
  });

  it("emits 4 tokens for four-sides padding", () => {
    const input: ComponentTokenConfig = {
      variants: ["primary"],
      cells: [
        {
          variant: "primary",
          property: "spacing-padding",
          paddingShape: "four-sides",
          states: [
            {
              state: "default",
              value: {
                top: "{spacing.md}",
                right: "{spacing.sm}",
                bottom: "{spacing.md}",
                left: "{spacing.sm}",
              },
            },
          ],
        },
      ],
    };

    const tokens = generateComponentTokens("button", input, SEMANTIC_TOKENS, PRIMITIVES);
    expect(tokens).toHaveLength(4);

    const sides = tokens.map((t) => t.path[t.path.length - 2]);
    expect(sides).toEqual(["top", "right", "bottom", "left"]);

    expect(tokens[0]!.$value).toBe("{spacing.md}");
    expect(tokens[1]!.$value).toBe("{spacing.sm}");
  });

  it("emits single token for single padding", () => {
    const input: ComponentTokenConfig = {
      variants: ["primary"],
      cells: [
        {
          variant: "primary",
          property: "spacing-padding",
          paddingShape: "single",
          states: [
            { state: "default", value: "{spacing.md}" },
          ],
        },
      ],
    };

    const tokens = generateComponentTokens("button", input, SEMANTIC_TOKENS, PRIMITIVES);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.path).toEqual(["button", "primary", "spacing", "padding", "default"]);
  });

  it("throws on unresolved reference BEFORE any side effect", () => {
    const input: ComponentTokenConfig = {
      variants: ["primary"],
      cells: [
        {
          variant: "primary",
          property: "color-background",
          states: [
            { state: "default", value: "{color.background.nonexistent}" },
          ],
        },
      ],
    };

    expect(() =>
      generateComponentTokens("button", input, SEMANTIC_TOKENS, PRIMITIVES),
    ).toThrow("Unresolved reference");
  });

  it("resolves a reference against primitives when not found in semantics", () => {
    const input: ComponentTokenConfig = {
      variants: ["primary"],
      cells: [
        {
          variant: "primary",
          property: "color-background",
          states: [
            { state: "default", value: "{color.blue.500}" },
          ],
        },
      ],
    };

    const tokens = generateComponentTokens("button", input, SEMANTIC_TOKENS, PRIMITIVES);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.$type).toBe("color");
  });
});
