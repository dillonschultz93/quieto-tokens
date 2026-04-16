import * as p from "@clack/prompts";
import type {
  PrimitiveToken,
  SemanticToken,
  ThemeCollection,
} from "../types/tokens.js";
import { hexToAnsi, supportsColor } from "../utils/color-display.js";
import { contrastRatio, meetsWcagAA } from "../utils/contrast.js";

const DTCG_REF_RE = /^\{color\.(\w+)\.(\d+)\}$/;

function resolveHex(
  ref: string,
  primitives: PrimitiveToken[],
): string | undefined {
  const match = ref.match(DTCG_REF_RE);
  if (!match) return undefined;
  const [, hue, step] = match;
  const prim = primitives.find(
    (t) => t.category === "color" && t.path[1] === hue && t.path[2] === step,
  );
  return prim?.$value;
}

function formatColorToken(
  token: PrimitiveToken,
  colorEnabled: boolean,
): string {
  const swatch = colorEnabled ? `${hexToAnsi(token.$value)} ` : "";
  return `${swatch}${token.name}  ${token.$value}`;
}

function wcagContrastSuffix(
  token: SemanticToken,
  semanticTokens: SemanticToken[],
  primitives: PrimitiveToken[],
): string | undefined {
  if (token.category !== "color" || token.path[1] !== "content") return undefined;

  const role = token.path[2]!;
  const bg = semanticTokens.find(
    (t) =>
      t.category === "color" &&
      t.path[1] === "background" &&
      t.path[2] === role,
  );
  if (!bg) return undefined;

  const bgHex = resolveHex(bg.$value, primitives);
  const fgHex = resolveHex(token.$value, primitives);
  if (!bgHex || !fgHex) return undefined;

  const ratio = contrastRatio(fgHex, bgHex);
  const rounded = Math.round(ratio * 10) / 10;
  const passes = meetsWcagAA(fgHex, bgHex);
  const mark = passes ? "✓" : "✗";

  return ` — ${token.name} on ${bg.name} → ${rounded}:1 ${mark} AA`;
}

function formatSemanticColorToken(
  token: SemanticToken,
  semanticTokens: SemanticToken[],
  primitives: PrimitiveToken[],
  colorEnabled: boolean,
): string {
  const hex = resolveHex(token.$value, primitives);
  const swatch =
    colorEnabled && hex ? `${hexToAnsi(hex)} ` : "";
  const wcag = wcagContrastSuffix(token, semanticTokens, primitives) ?? "";
  return `${swatch}${token.name}  → ${token.$value}${wcag}`;
}

function renderColorPrimitives(
  primitives: PrimitiveToken[],
  colorEnabled: boolean,
): void {
  const colorPrims = primitives.filter((t) => t.category === "color");
  const byHue = new Map<string, PrimitiveToken[]>();

  for (const prim of colorPrims) {
    const hue = prim.path[1]!;
    if (!byHue.has(hue)) byHue.set(hue, []);
    byHue.get(hue)!.push(prim);
  }

  p.log.step("Color Primitives");
  for (const [hue, tokens] of byHue) {
    const lines = tokens.map((t) => formatColorToken(t, colorEnabled));
    p.log.info(`${hue}\n${lines.join("\n")}`);
  }
}

function renderSpacingPrimitives(primitives: PrimitiveToken[]): void {
  const spacingPrims = primitives.filter((t) => t.category === "spacing");
  p.log.step("Spacing Primitives");
  const lines = spacingPrims.map((t) => `${t.name}  ${t.$value}`);
  p.log.info(lines.join("\n"));
}

function renderTypographyPrimitives(primitives: PrimitiveToken[]): void {
  const typoPrims = primitives.filter((t) => t.category === "typography");
  p.log.step("Typography Primitives");
  const lines = typoPrims.map((t) => `${t.name}  ${t.$value}`);
  p.log.info(lines.join("\n"));
}

function renderSemanticMappings(
  theme: { name: string; semanticTokens: SemanticToken[] },
  primitives: PrimitiveToken[],
  colorEnabled: boolean,
): void {
  const label =
    theme.name === "default"
      ? "Semantic Mappings"
      : `Semantic Mappings (${theme.name.charAt(0).toUpperCase() + theme.name.slice(1)})`;

  p.log.step(label);

  const colorTokens = theme.semanticTokens.filter(
    (t) => t.category === "color",
  );
  const spacingTokens = theme.semanticTokens.filter(
    (t) => t.category === "spacing",
  );
  const typoTokens = theme.semanticTokens.filter(
    (t) => t.category === "typography",
  );

  if (colorTokens.length > 0) {
    const lines = colorTokens.map((t) =>
      formatSemanticColorToken(t, theme.semanticTokens, primitives, colorEnabled),
    );
    p.log.info(`Color\n${lines.join("\n")}`);
  }

  if (spacingTokens.length > 0) {
    const lines = spacingTokens.map(
      (t) => `${t.name}  → ${t.$value}`,
    );
    p.log.info(`Spacing\n${lines.join("\n")}`);
  }

  if (typoTokens.length > 0) {
    const lines = typoTokens.map(
      (t) => `${t.name}  → ${t.$value}`,
    );
    p.log.info(`Typography\n${lines.join("\n")}`);
  }
}

export function renderPreview(collection: ThemeCollection): void {
  const colorEnabled = supportsColor();

  renderColorPrimitives(collection.primitives, colorEnabled);
  renderSpacingPrimitives(collection.primitives);
  renderTypographyPrimitives(collection.primitives);

  for (const theme of collection.themes) {
    renderSemanticMappings(theme, collection.primitives, colorEnabled);
  }
}

export function renderTokenCountSummary(collection: ThemeCollection): void {
  const primitiveCount = collection.primitives.length;
  const themeCount = collection.themes.length;
  const semanticPerTheme = collection.themes[0]?.semanticTokens.length ?? 0;
  const semanticRows = collection.themes.reduce(
    (sum, t) => sum + t.semanticTokens.length,
    0,
  );
  const totalRecords = primitiveCount + semanticRows;
  const themeWord = themeCount === 1 ? "theme" : "themes";

  p.log.success(
    `${totalRecords} token records — ${primitiveCount} primitives; ${semanticRows} semantic rows across ${themeCount} ${themeWord} (${semanticPerTheme} per theme)`,
  );
}

export interface OverrideResult {
  overrides: Map<string, string>;
  cancelled: boolean;
}

type SemanticCategory =
  | "color-background"
  | "color-content"
  | "color-border"
  | "spacing"
  | "typography";

function categorizeSemanticTokens(
  tokens: SemanticToken[],
): Map<SemanticCategory, SemanticToken[]> {
  const categories = new Map<SemanticCategory, SemanticToken[]>();

  for (const token of tokens) {
    let cat: SemanticCategory;
    if (token.category === "color") {
      const property = token.path[1] as "background" | "content" | "border";
      cat = `color-${property}` as SemanticCategory;
    } else if (token.category === "spacing") {
      cat = "spacing";
    } else {
      cat = "typography";
    }
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(token);
  }

  return categories;
}

function getPrimitiveAlternatives(
  token: SemanticToken,
  primitives: PrimitiveToken[],
): Array<{ value: string; label: string }> {
  if (token.category === "color") {
    const colorPrims = primitives.filter((pr) => pr.category === "color");
    return colorPrims.map((pr) => ({
      value: `{${pr.path.join(".")}}`,
      label: `${pr.name}  ${pr.$value}`,
    }));
  }
  if (token.category === "spacing") {
    const spacingPrims = primitives.filter((pr) => pr.category === "spacing");
    return spacingPrims.map((pr) => ({
      value: `{${pr.path.join(".")}}`,
      label: `${pr.name}  ${pr.$value}`,
    }));
  }
  const typoPrims = primitives.filter((pr) => pr.category === "typography");
  return typoPrims.map((pr) => ({
    value: `{${pr.path.join(".")}}`,
    label: `${pr.name}  ${pr.$value}`,
  }));
}

export async function runOverrideFlow(
  collection: ThemeCollection,
): Promise<OverrideResult> {
  const overrides = new Map<string, string>();
  const baseTheme = collection.themes[0]!;

  while (true) {
    const accept = await p.confirm({
      message: "Accept these mappings? (or override specific tokens)",
    });

    if (p.isCancel(accept)) {
      return { overrides, cancelled: true };
    }

    if (accept) {
      return { overrides, cancelled: false };
    }

    const categories = categorizeSemanticTokens(baseTheme.semanticTokens);
    const categoryOptions = [...categories.keys()].map((cat) => ({
      value: cat,
      label: cat
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    }));

    const selectedCategory = await p.select({
      message: "Which category to override?",
      options: categoryOptions,
    });

    if (p.isCancel(selectedCategory)) {
      return { overrides, cancelled: true };
    }

    const tokensInCategory = categories.get(
      selectedCategory as SemanticCategory,
    )!;
    const tokenOptions = tokensInCategory.map((t) => ({
      value: t.name,
      label: `${t.name}  → ${t.$value}`,
    }));

    const selectedToken = await p.select({
      message: "Select token to override:",
      options: tokenOptions,
    });

    if (p.isCancel(selectedToken)) {
      return { overrides, cancelled: true };
    }

    const token = tokensInCategory.find(
      (t) => t.name === selectedToken,
    )!;
    const alternatives = getPrimitiveAlternatives(
      token,
      collection.primitives,
    );

    const newValue = await p.select({
      message: `New value for ${token.name} (currently ${token.$value}):`,
      options: alternatives,
    });

    if (p.isCancel(newValue)) {
      return { overrides, cancelled: true };
    }

    overrides.set(token.name, newValue as string);

    token.$value = newValue as string;
    for (const theme of collection.themes) {
      const themeToken = theme.semanticTokens.find(
        (t) => t.name === token.name,
      );
      if (themeToken && themeToken !== token) {
        themeToken.$value = newValue as string;
      }
    }
  }
}

export interface PreviewResult {
  collection: ThemeCollection;
  overrides: Map<string, string>;
}

export async function previewAndConfirm(
  collection: ThemeCollection,
): Promise<PreviewResult | null> {
  renderPreview(collection);
  renderTokenCountSummary(collection);

  const result = await runOverrideFlow(collection);

  if (result.cancelled) {
    p.cancel("Preview cancelled.");
    return null;
  }

  return {
    collection,
    overrides: result.overrides,
  };
}
