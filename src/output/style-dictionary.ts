import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import StyleDictionary from "style-dictionary";
import type { ThemeCollection } from "../types/tokens.js";

const PREFIX = "quieto";

function toPosix(p: string): string {
  return p.split("\\").join("/");
}

function silenceLogs() {
  return {
    warnings: "disabled",
    verbosity: "silent",
    errors: {
      // Fail loudly on unresolved DTCG references (e.g. `{color.blue.9999}`).
      // Without this, bad refs emit `undefined` into the CSS silently and the
      // pipeline still reports success — the opposite of AC #7's intent.
      brokenReferences: "throw",
    },
  } as const;
}

/**
 * Minimal subset of Style Dictionary's `TransformedToken` we rely on.
 * Intentionally narrower than SD's public type so changes to fields we don't
 * use can't break our filters.
 */
type TokenLike = { path: string[]; filePath?: string };

function isSemanticToken(token: TokenLike): boolean {
  const fp = token.filePath ?? "";
  return toPosix(fp).includes("/tokens/semantic/");
}

function isComponentToken(token: TokenLike): boolean {
  const fp = token.filePath ?? "";
  return toPosix(fp).includes("/tokens/component/");
}

function isSemanticOrComponentToken(token: TokenLike): boolean {
  return isSemanticToken(token) || isComponentToken(token);
}

/**
 * Custom name transform that composes the CSS variable name from the token
 * path and injects a `semantic-` segment for tokens sourced from
 * `tokens/semantic/**`. Combined with `prefix: "quieto"` this yields names
 * like `--quieto-color-blue-500` for primitives and
 * `--quieto-semantic-color-background-primary` for semantics, without having
 * to mutate the on-disk JSON shape.
 */
const QUIETO_NAME_TRANSFORM = "name/quieto";

const IOS_NAME_TRANSFORM = "name/ios";
const IOS_COLOR_FORMAT = "ios/color-swift";
const IOS_SPACING_FORMAT = "ios/spacing-swift";
const IOS_TYPOGRAPHY_FORMAT = "ios/typography-swift";

const FIGMA_NAME_TRANSFORM = "name/figma";
const FIGMA_JSON_FORMAT = "figma/json";

let transformRegistered = false;
function ensureQuietoTransformRegistered(): void {
  if (transformRegistered) return;
  StyleDictionary.registerTransform({
    name: QUIETO_NAME_TRANSFORM,
    type: "name",
    transform: (token, config) => {
      const prefix = config.prefix;
      let tierSegment: string[] = [];
      let tokenPath = [...token.path];

      if (isComponentToken(token)) {
        tierSegment = ["component"];
        if (
          tokenPath.length > 0 &&
          tokenPath[tokenPath.length - 1] === "default"
        ) {
          tokenPath = tokenPath.slice(0, -1);
        }
      } else if (isSemanticToken(token)) {
        tierSegment = ["semantic"];
      }

      return [prefix, ...tierSegment, ...tokenPath]
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .join("-");
    },
  });
  transformRegistered = true;
}

let figmaHooksRegistered = false;
function ensureFigmaNameAndFormatRegistered(): void {
  if (figmaHooksRegistered) return;
  StyleDictionary.registerTransform({
    name: FIGMA_NAME_TRANSFORM,
    type: "name",
    transform: (token) => {
      const tokenPath = [...token.path];

      if (isComponentToken(token)) {
        return ["component", ...tokenPath]
          .filter((s) => s.length > 0)
          .join("/");
      }
      if (isSemanticToken(token)) {
        return ["semantic", ...tokenPath]
          .filter((s) => s.length > 0)
          .join("/");
      }
      return tokenPath.filter((s) => s.length > 0).join("/");
    },
  });
  StyleDictionary.registerFormat({
    name: FIGMA_JSON_FORMAT,
    format: ({ dictionary }): string => {
      const root = Object.create(null) as Record<string, unknown>;
      for (const t of dictionary.allTokens) {
        const tok = t as {
          name: string;
          $value?: unknown;
          $type?: string;
          path: string[];
          original?: { $value?: unknown; value?: unknown };
        };
        const segs = tok.name.split("/").filter((s) => s.length > 0);
        if (segs.length === 0) continue;
        const typeStr = typeof tok.$type === "string" ? tok.$type : "unknown";
        setNestedLeaf(root, segs, {
          $type: typeStr,
          $value: figmaOutputValue(
            tok as {
              $value?: unknown;
              original?: { $value?: unknown; value?: unknown };
            },
          ),
        });
      }
      return JSON.stringify(root, null, 2) + "\n";
    },
  });
  figmaHooksRegistered = true;
}

/**
 * Nests tokens by "/"-separated Figma name segments. Later segments win on
 * collision the same way shallow merges would (should not happen with
 * disambiguated paths).
 */
function setNestedLeaf(
  target: Record<string, unknown>,
  pathSegments: string[],
  leaf: Record<string, unknown>,
): void {
  if (pathSegments.length === 0) return;
  const [head, ...rest] = pathSegments;
  if (rest.length === 0) {
    target[head!] = leaf;
    return;
  }
  let next = target[head!] as Record<string, unknown> | undefined;
  if (next === undefined || typeof next !== "object" || !isPlainObject(next)) {
    next = Object.create(null) as Record<string, unknown>;
    target[head!] = next;
  }
  setNestedLeaf(next, rest, leaf);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Prefer the original DTCG reference string for cross-tier links; otherwise
 * the transformed resolved value.
 */
function figmaOutputValue(token: {
  $value?: unknown;
  original?: { $value?: unknown; value?: unknown };
}): unknown {
  const original = token.original;
  const oVal = original?.$value ?? original?.value;
  if (typeof oVal === "string" && /^\{[^}]+\}$/.test(oVal.trim())) {
    return oVal;
  }
  if (oVal && typeof oVal === "object" && !Array.isArray(oVal)) {
    return oVal;
  }
  return token.$value;
}

const FIGMA_TRANSFORMS: string[] = [
  "attribute/cti",
  FIGMA_NAME_TRANSFORM,
  "time/seconds",
  "html/icon",
  "size/rem",
  "color/css",
  "asset/url",
  "fontFamily/css",
  "cubicBezier/css",
  "strokeStyle/css/shorthand",
  "border/css/shorthand",
  "typography/css/shorthand",
  "transition/css/shorthand",
  "shadow/css/shorthand",
];

/**
 * Full CSS transform chain, with `name/kebab` replaced by our custom
 * `name/quieto`. Mirrors Style Dictionary v5's `css` transformGroup so we
 * get size/rem, color/css, css shorthand composites, etc. for free.
 */
const CSS_TRANSFORMS_WITH_QUIETO_NAME: string[] = [
  "attribute/cti",
  QUIETO_NAME_TRANSFORM,
  "time/seconds",
  "html/icon",
  "size/rem",
  "color/css",
  "asset/url",
  "fontFamily/css",
  "cubicBezier/css",
  "strokeStyle/css/shorthand",
  "border/css/shorthand",
  "typography/css/shorthand",
  "transition/css/shorthand",
  "shadow/css/shorthand",
];

async function runSingleTheme(
  outputDir: string,
  themeName: string,
): Promise<string[]> {
  ensureQuietoTransformRegistered();

  const source = [
    toPosix(join(outputDir, "tokens", "primitive", "**/*.json")),
    toPosix(join(outputDir, "tokens", "semantic", themeName, "**/*.json")),
    toPosix(join(outputDir, "tokens", "component", "**/*.json")),
  ];

  const sd = new StyleDictionary({
    source,
    usesDtcg: true,
    log: silenceLogs(),
    platforms: {
      css: {
        transforms: CSS_TRANSFORMS_WITH_QUIETO_NAME,
        prefix: PREFIX,
        buildPath: toPosix(join(outputDir, "build")) + "/",
        files: [
          {
            destination: "tokens.css",
            format: "css/variables",
            options: {
              selector: ":root",
              outputReferences: true,
            },
          },
        ],
      },
    },
  });

  await sd.buildAllPlatforms();
  return [join(outputDir, "build", "tokens.css")];
}

async function runPrimitivesOnly(outputDir: string): Promise<string> {
  ensureQuietoTransformRegistered();

  const source = [
    toPosix(join(outputDir, "tokens", "primitive", "**/*.json")),
  ];

  const sd = new StyleDictionary({
    source,
    usesDtcg: true,
    log: silenceLogs(),
    platforms: {
      css: {
        transforms: CSS_TRANSFORMS_WITH_QUIETO_NAME,
        prefix: PREFIX,
        buildPath: toPosix(join(outputDir, "build")) + "/",
        files: [
          {
            destination: "primitives.css",
            format: "css/variables",
            options: {
              selector: ":root",
              outputReferences: true,
            },
          },
        ],
      },
    },
  });

  await sd.buildAllPlatforms();
  return join(outputDir, "build", "primitives.css");
}

async function runThemeSemantics(
  outputDir: string,
  themeName: string,
  selector: string,
): Promise<string> {
  ensureQuietoTransformRegistered();

  const source = [
    toPosix(join(outputDir, "tokens", "primitive", "**/*.json")),
    toPosix(join(outputDir, "tokens", "semantic", themeName, "**/*.json")),
    toPosix(join(outputDir, "tokens", "component", "**/*.json")),
  ];

  const sd = new StyleDictionary({
    source,
    usesDtcg: true,
    log: silenceLogs(),
    platforms: {
      css: {
        transforms: CSS_TRANSFORMS_WITH_QUIETO_NAME,
        prefix: PREFIX,
        buildPath: toPosix(join(outputDir, "build")) + "/",
        files: [
          {
            destination: `${themeName}.css`,
            format: "css/variables",
            filter: (token: TokenLike) => isSemanticOrComponentToken(token),
            options: {
              selector,
              outputReferences: true,
            },
          },
        ],
      },
    },
  });

  await sd.buildAllPlatforms();
  return join(outputDir, "build", `${themeName}.css`);
}

export async function buildCss(
  collection: ThemeCollection,
  outputDir: string,
): Promise<string[]> {
  const themes = collection.themes;

  if (themes.length === 1) {
    return runSingleTheme(outputDir, themes[0]!.name);
  }

  const written: string[] = [];

  written.push(await runPrimitivesOnly(outputDir));

  for (const theme of themes) {
    const selector =
      theme.name === "dark" ? '[data-theme="dark"]' : ":root";
    written.push(await runThemeSemantics(outputDir, theme.name, selector));
  }

  return written;
}

function createFigmaStyleDictionary(
  outputDir: string,
  themeName: string,
): InstanceType<typeof StyleDictionary> {
  ensureFigmaNameAndFormatRegistered();
  const source = [
    toPosix(join(outputDir, "tokens", "primitive", "**/*.json")),
    toPosix(join(outputDir, "tokens", "semantic", themeName, "**/*.json")),
    toPosix(join(outputDir, "tokens", "component", "**/*.json")),
  ];
  return new StyleDictionary({
    source,
    usesDtcg: true,
    log: silenceLogs(),
    platforms: {
      figma: {
        transforms: FIGMA_TRANSFORMS,
        buildPath: toPosix(join(outputDir, "build")) + "/",
        files: [
          {
            destination: "tokens.figma.json",
            format: FIGMA_JSON_FORMAT,
            options: { outputReferences: true },
          },
        ],
      },
    },
  });
}

/**
 * Emit `build/tokens.figma.json` with top-level theme keys, each containing
 * primitives, that theme’s semantics, and component tokens in a nested
 * Tokens Studio–shaped object.
 */
export async function buildFigmaJson(
  collection: ThemeCollection,
  outputDir: string,
): Promise<string[]> {
  const themes = collection.themes;
  const merged = Object.create(null) as Record<string, unknown>;
  for (const th of themes) {
    const sd = createFigmaStyleDictionary(outputDir, th.name);
    const parts = await sd.formatPlatform("figma");
    const out = parts[0]?.output;
    if (typeof out !== "string") {
      throw new Error("Figma format produced no output");
    }
    merged[th.name] = JSON.parse(out) as unknown;
  }
  const dest = join(outputDir, "build", "tokens.figma.json");
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, JSON.stringify(merged, null, 2) + "\n", "utf-8");
  return [dest];
}

// ---------------------------------------------------------------------------
// iOS Swift output
// ---------------------------------------------------------------------------

function toCamelCase(segments: string[]): string {
  return segments
    .filter((s) => s.length > 0)
    .map((s, i) => {
      const cleaned = s.replace(/-([a-z0-9])/g, (_, ch: string) =>
        ch.toUpperCase(),
      );
      if (i === 0) return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    })
    .join("");
}

let iosHooksRegistered = false;
function ensureIosHooksRegistered(): void {
  if (iosHooksRegistered) return;

  StyleDictionary.registerTransform({
    name: IOS_NAME_TRANSFORM,
    type: "name",
    transform: (token) => {
      const tokenPath = [...token.path];
      if (isComponentToken(token)) {
        return toCamelCase(["component", ...tokenPath]);
      }
      if (isSemanticToken(token)) {
        return toCamelCase(["semantic", ...tokenPath]);
      }
      return toCamelCase(tokenPath);
    },
  });

  StyleDictionary.registerFormat({
    name: IOS_COLOR_FORMAT,
    format: ({ dictionary }): string => {
      const header =
        "// Do not edit directly, this file was auto-generated.\n\nimport UIKit\nimport SwiftUI\n";

      let uiColorBlock = "\npublic extension UIColor {\n";
      let swiftUIBlock = "\npublic extension Color {\n";

      for (const t of dictionary.allTokens) {
        const tok = t as { name: string; $value?: unknown };
        const val = tok.$value;
        if (typeof val !== "string") continue;
        uiColorBlock += `    public static let ${tok.name} = ${val}\n`;
        swiftUIBlock += `    public static let ${tok.name} = Color(uiColor: .${tok.name})\n`;
      }

      uiColorBlock += "}\n";
      swiftUIBlock += "}\n";
      return header + uiColorBlock + swiftUIBlock;
    },
  });

  StyleDictionary.registerFormat({
    name: IOS_SPACING_FORMAT,
    format: ({ dictionary }): string => {
      const header =
        "// Do not edit directly, this file was auto-generated.\n\nimport CoreGraphics\n";
      let body = "\npublic enum Spacing {\n";
      for (const t of dictionary.allTokens) {
        const tok = t as { name: string; $value?: unknown };
        const val = tok.$value;
        if (typeof val !== "string" && typeof val !== "number") continue;
        const num =
          typeof val === "number"
            ? val
            : parseFloat(String(val).replace(/[^0-9.]/g, ""));
        if (Number.isNaN(num)) continue;
        const formatted = Number.isInteger(num) ? String(num) : num.toFixed(2);
        body += `    public static let ${tok.name}: CGFloat = ${formatted}\n`;
      }
      body += "}\n";
      return header + body;
    },
  });

  StyleDictionary.registerFormat({
    name: IOS_TYPOGRAPHY_FORMAT,
    format: ({ dictionary }): string => {
      const header =
        "// Do not edit directly, this file was auto-generated.\n\nimport CoreGraphics\n";
      let body = "\npublic enum Typography {\n";
      for (const t of dictionary.allTokens) {
        const tok = t as { name: string; $type?: string; $value?: unknown };
        const val = tok.$value;
        if (val === undefined || val === null) continue;
        const $type = tok.$type ?? "";
        if ($type === "fontWeight" || $type === "number") {
          body += `    public static let ${tok.name}: CGFloat = ${val}\n`;
        } else if ($type === "fontFamily") {
          const str = Array.isArray(val) ? val[0] : val;
          body += `    public static let ${tok.name}: String = ${JSON.stringify(str)}\n`;
        } else {
          const num = parseFloat(String(val).replace(/[^0-9.]/g, ""));
          if (Number.isNaN(num)) continue;
          const formatted = Number.isInteger(num)
            ? String(num)
            : num.toFixed(2);
          body += `    public static let ${tok.name}: CGFloat = ${formatted}\n`;
        }
      }
      body += "}\n";
      return header + body;
    },
  });

  iosHooksRegistered = true;
}

function isColorCategory(token: TokenLike): boolean {
  return token.path[0] === "color";
}

function isSpacingCategory(token: TokenLike): boolean {
  return token.path[0] === "spacing";
}

function isTypographyCategory(token: TokenLike): boolean {
  return token.path[0] === "typography";
}

const IOS_TRANSFORMS: string[] = [
  "attribute/cti",
  IOS_NAME_TRANSFORM,
  "color/UIColorSwift",
];

function createIosStyleDictionary(
  outputDir: string,
  themeName: string,
  buildPath: string,
): InstanceType<typeof StyleDictionary> {
  ensureIosHooksRegistered();

  const source = [
    toPosix(join(outputDir, "tokens", "primitive", "**/*.json")),
    toPosix(join(outputDir, "tokens", "semantic", themeName, "**/*.json")),
    toPosix(join(outputDir, "tokens", "component", "**/*.json")),
  ];

  return new StyleDictionary({
    source,
    usesDtcg: true,
    log: silenceLogs(),
    platforms: {
      ios: {
        transforms: IOS_TRANSFORMS,
        buildPath: toPosix(buildPath) + "/",
        files: [
          {
            destination: "Color.swift",
            format: IOS_COLOR_FORMAT,
            filter: (token: TokenLike) => isColorCategory(token),
          },
          {
            destination: "Spacing.swift",
            format: IOS_SPACING_FORMAT,
            filter: (token: TokenLike) => isSpacingCategory(token),
          },
          {
            destination: "Typography.swift",
            format: IOS_TYPOGRAPHY_FORMAT,
            filter: (token: TokenLike) => isTypographyCategory(token),
          },
        ],
      },
    },
  });
}

export async function buildIos(
  collection: ThemeCollection,
  outputDir: string,
): Promise<string[]> {
  const themes = collection.themes;
  const buildPath = join(outputDir, "build", "ios");

  if (themes.length === 1) {
    const sd = createIosStyleDictionary(outputDir, themes[0]!.name, buildPath);
    await sd.buildAllPlatforms();
    const candidates = [
      join(buildPath, "Color.swift"),
      join(buildPath, "Spacing.swift"),
      join(buildPath, "Typography.swift"),
    ];
    const written: string[] = [];
    for (const p of candidates) {
      try {
        await stat(p);
        written.push(p);
      } catch {
        // SD skips files when the filter matches no tokens
      }
    }
    return written;
  }

  // Multi-theme: build per-theme formatted output, then merge into theme enums
  const themeOutputs = new Map<
    string,
    { colors: string; spacing: string; typography: string }
  >();

  for (const theme of themes) {
    const sd = createIosStyleDictionary(outputDir, theme.name, buildPath);
    const parts = await sd.formatPlatform("ios");
    const mapped = Object.create(null) as Record<string, string>;
    for (const part of parts) {
      const dest = (part.destination ?? "").split("/").pop() ?? "";
      mapped[dest] = typeof part.output === "string" ? part.output : "";
    }
    themeOutputs.set(theme.name, {
      colors: mapped["Color.swift"] ?? "",
      spacing: mapped["Spacing.swift"] ?? "",
      typography: mapped["Typography.swift"] ?? "",
    });
  }

  await mkdir(buildPath, { recursive: true });

  const written: string[] = [];

  const fileDefs: Array<{
    name: string;
    field: "colors" | "spacing" | "typography";
    imports: string[];
  }> = [
    { name: "Color.swift", field: "colors", imports: ["UIKit", "SwiftUI"] },
    { name: "Spacing.swift", field: "spacing", imports: ["CoreGraphics"] },
    { name: "Typography.swift", field: "typography", imports: ["CoreGraphics"] },
  ];

  for (const def of fileDefs) {
    const hasContent = themes.some((t) => {
      const out = themeOutputs.get(t.name);
      return out && extractMembers(out[def.field]).length > 0;
    });
    if (!hasContent) continue;
    const filePath = join(buildPath, def.name);
    await writeFile(
      filePath,
      buildMultiThemeSwift(
        def.name.replace(".swift", ""),
        themes.map((t) => t.name),
        themeOutputs,
        def.field,
        def.imports,
      ),
      "utf-8",
    );
    written.push(filePath);
  }

  return written;
}

function buildMultiThemeSwift(
  category: string,
  themeNames: string[],
  themeOutputs: Map<
    string,
    { colors: string; spacing: string; typography: string }
  >,
  field: "colors" | "spacing" | "typography",
  imports: string[],
): string {
  const header =
    "// Do not edit directly, this file was auto-generated.\n\n" +
    imports.map((i) => `import ${i}`).join("\n") +
    "\n";

  let body = `\npublic enum Theme {\n`;
  for (const name of themeNames) {
    const output = themeOutputs.get(name);
    if (!output) continue;
    const raw = output[field];
    let members = extractMembers(raw);
    if (field === "colors") {
      members = members.filter((l) => l.includes("UIColor("));
    }
    const enumName = name.charAt(0).toUpperCase() + name.slice(1);
    body += `    public enum ${enumName} {\n`;
    for (const line of members) {
      body += `        ${line}\n`;
    }
    body += `    }\n`;
  }
  body += `}\n`;

  if (field === "colors") {
    body += buildMultiThemeSwiftUIColors(themeNames, themeOutputs);
  }

  return header + body;
}

function extractMembers(formatOutput: string): string[] {
  const lines: string[] = [];
  for (const line of formatOutput.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("static let ") || trimmed.startsWith("public static let ")) {
      lines.push(
        trimmed.startsWith("public ") ? trimmed : `public ${trimmed}`,
      );
    }
  }
  return lines;
}

function buildMultiThemeSwiftUIColors(
  themeNames: string[],
  themeOutputs: Map<
    string,
    { colors: string; spacing: string; typography: string }
  >,
): string {
  let block = "";
  for (const name of themeNames) {
    const output = themeOutputs.get(name);
    if (!output) continue;
    const raw = output.colors;
    const uiColorMembers = extractMembers(raw).filter((l) =>
      l.includes("UIColor("),
    );
    if (uiColorMembers.length === 0) continue;
    const enumName = name.charAt(0).toUpperCase() + name.slice(1);
    block += `\npublic extension Color {\n`;
    block += `    enum ${enumName} {\n`;
    for (const line of uiColorMembers) {
      const match = line.match(
        /static let (\w+)\s*=\s*UIColor\(/,
      );
      if (match) {
        block += `        public static let ${match[1]} = Color(uiColor: Theme.${enumName}.${match[1]})\n`;
      }
    }
    block += `    }\n`;
    block += `}\n`;
  }
  return block;
}
