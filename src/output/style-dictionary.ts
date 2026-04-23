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

const ANDROID_XML_NAME = "name/android-xml";
const ANDROID_COMPOSE_NAME = "name/android-compose";
const ANDROID_COLORS_XML = "android/colors-xml";
const ANDROID_DIMENS_XML = "android/dimens-xml";
const ANDROID_TYPOGRAPHY_DIMENS_XML = "android/typography-dimens-xml";
const ANDROID_TYPOGRAPHY_STRINGS_XML = "android/typography-strings-xml";
const ANDROID_COLOR_COMPOSE = "android/color-compose";
const ANDROID_SPACING_COMPOSE = "android/spacing-compose";
const ANDROID_TYPOGRAPHY_COMPOSE = "android/typography-compose";

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

// ---------------------------------------------------------------------------
// Android output (resource XML and Jetpack Compose)
// ---------------------------------------------------------------------------

function pascalFromSegmentsForCompose(segments: string[]): string {
  return segments
    .filter((s) => s.length > 0)
    .map((s) => {
      if (/^\d+$/.test(s)) return s;
      const t = s.replace(/-([a-z0-9])/g, (_: string, c: string) => c.toUpperCase());
      return t.charAt(0).toUpperCase() + t.slice(1);
    })
    .join("");
}

let androidHooksRegistered = false;
function ensureAndroidHooksRegistered(): void {
  if (androidHooksRegistered) return;

  StyleDictionary.registerTransform({
    name: ANDROID_XML_NAME,
    type: "name",
    transform: (token, config) => {
      const prefix = String(config.prefix ?? PREFIX);
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
        .join("-")
        .replace(/-/g, "_");
    },
  });

  StyleDictionary.registerTransform({
    name: ANDROID_COMPOSE_NAME,
    type: "name",
    transform: (token) => {
      if (isComponentToken(token)) {
        return pascalFromSegmentsForCompose(
          ["component", ...token.path].map(String),
        );
      }
      if (isSemanticToken(token)) {
        return pascalFromSegmentsForCompose(
          ["semantic", ...token.path].map(String),
        );
      }
      const p = token.path.map(String);
      if (p[0] === "color" && p.length >= 2) {
        return pascalFromSegmentsForCompose(p.slice(1));
      }
      if (p[0] === "spacing" && p.length >= 2) {
        return `Space${p[1]}`;
      }
      if (p[0] === "typography" && p.length >= 1) {
        return p.length >= 2
          ? pascalFromSegmentsForCompose(p.slice(1))
          : pascalFromSegmentsForCompose(p);
      }
      return pascalFromSegmentsForCompose(p);
    },
  });

  StyleDictionary.registerFormat({
    name: ANDROID_COLORS_XML,
    format: ({ dictionary }): string => {
      const lines: string[] = [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<resources>",
      ];
      for (const t of dictionary.allTokens) {
        const tok = t as { name: string; $value?: unknown };
        const v = tok.$value;
        if (typeof v !== "string" || !v.startsWith("#")) continue;
        lines.push(`  <color name="${tok.name}">${v.toUpperCase()}</color>`);
      }
      lines.push("</resources>\n");
      return lines.join("\n");
    },
  });

  function dimenFromTokenValue(
    $value: unknown,
    $type: string,
  ): string | null {
    if (typeof $value === "number" && Number.isFinite($value)) {
      if ($type === "fontWeight" || $type === "number") {
        return `${$value}sp`;
      }
      return `${$value}dp`;
    }
    if (typeof $value !== "string") return null;
    const s = $value.trim();
    const n = parseFloat(s.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(n)) return null;
    if (s.includes("rem")) {
      return `${Math.round(n * 16)}dp`;
    }
    if (s.endsWith("px")) {
      return `${Math.round(n)}dp`;
    }
    if (s.endsWith("sp") || s.endsWith("dp") || s.endsWith("em")) {
      return s; // keep as token written
    }
    return Number.isInteger(n) ? `${n}dp` : `${n}dp`;
  }

  StyleDictionary.registerFormat({
    name: ANDROID_DIMENS_XML,
    format: ({ dictionary }): string => {
      const lines: string[] = [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<resources>",
      ];
      for (const t of dictionary.allTokens) {
        const tok = t as { name: string; $value?: unknown; $type?: string };
        const dimen = dimenFromTokenValue(tok.$value, tok.$type ?? "");
        if (dimen === null) continue;
        lines.push(`  <dimen name="${tok.name}">${dimen}</dimen>`);
      }
      lines.push("</resources>\n");
      return lines.join("\n");
    },
  });

  StyleDictionary.registerFormat({
    name: ANDROID_TYPOGRAPHY_DIMENS_XML,
    format: ({ dictionary }): string => {
      const lines: string[] = [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<resources>",
      ];
      for (const t of dictionary.allTokens) {
        const tok = t as { name: string; $value?: unknown; $type?: string };
        if (tok.$type === "fontFamily") continue;
        const dimen = dimenFromTokenValue(tok.$value, tok.$type ?? "");
        if (dimen === null) continue;
        const isSp = tok.name.includes("line");
        const unit = isSp ? dimen : dimen.replace(/dp$/, "sp");
        lines.push(`  <dimen name="${tok.name}">${unit}</dimen>`);
      }
      lines.push("</resources>\n");
      return lines.join("\n");
    },
  });

  StyleDictionary.registerFormat({
    name: ANDROID_TYPOGRAPHY_STRINGS_XML,
    format: ({ dictionary }): string => {
      const lines: string[] = [
        '<?xml version="1.0" encoding="utf-8"?>',
        "<resources>",
      ];
      for (const t of dictionary.allTokens) {
        const tok = t as { name: string; $value?: unknown; $type?: string };
        if (tok.$type !== "fontFamily") continue;
        const val = tok.$value;
        const s =
          typeof val === "string" ? val : Array.isArray(val) ? val[0] : "";
        if (typeof s !== "string" || s.length === 0) continue;
        const escaped = s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "\\'")
          .replace(/\\/g, "\\\\");
        lines.push(`  <string name="${tok.name}">${escaped}</string>`);
      }
      lines.push("</resources>\n");
      return lines.join("\n");
    },
  });

  function hexStringToComposeColor(hex: string): string {
    const h = hex.replace(/^#/, "");
    if (h.length === 6) return `0xFF${h.toUpperCase()}`;
    if (h.length === 8) return `0x${h.toUpperCase()}`;
    return "0xFF000000";
  }

  StyleDictionary.registerFormat({
    name: ANDROID_COLOR_COMPOSE,
    format: ({ dictionary }): string => {
      const header = `// Do not edit directly; auto-generated.
package com.quieto.tokens

import androidx.compose.ui.graphics.Color
`;
      const lines: string[] = ["", "object QuietoColors {", ""];
      for (const t of dictionary.allTokens) {
        const tok = t as { name: string; $value?: unknown };
        if (typeof tok.$value !== "string" || !String(tok.$value).startsWith("#")) {
          continue;
        }
        const lit = hexStringToComposeColor(tok.$value);
        lines.push(`  val ${tok.name} = Color(${lit})`);
        lines.push("");
      }
      lines.push("}");
      return header + lines.join("\n") + "\n";
    },
  });

  StyleDictionary.registerFormat({
    name: ANDROID_SPACING_COMPOSE,
    format: ({ dictionary }): string => {
      const header = `// Do not edit directly; auto-generated.
package com.quieto.tokens

import androidx.compose.ui.unit.dp
`;
      const lines: string[] = ["", "object QuietoSpacing {", ""];
      for (const t of dictionary.allTokens) {
        const tok = t as { name: string; $value?: unknown; $type?: string };
        const d = dimenFromTokenValue(tok.$value, tok.$type ?? "");
        if (d === null) continue;
        const num = parseFloat(d.replace(/[^0-9.]/g, ""));
        if (Number.isNaN(num)) continue;
        const numLit = Number.isInteger(num)
          ? String(Math.round(num))
          : String(num);
        lines.push(`  val ${tok.name} = ${numLit}.dp`);
        lines.push("");
      }
      lines.push("}");
      return header + lines.join("\n") + "\n";
    },
  });

  StyleDictionary.registerFormat({
    name: ANDROID_TYPOGRAPHY_COMPOSE,
    format: ({ dictionary }): string => {
      const header = `// Do not edit directly; auto-generated.
package com.quieto.tokens

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
`;
      const lines: string[] = [
        "",
        "object QuietoTypography {",
        "",
      ];
      for (const t of dictionary.allTokens) {
        const tok = t as { name: string; $value?: unknown; $type?: string };
        if (tok.$value === undefined || tok.$value === null) continue;
        const $type = tok.$type ?? "";
        if ($type === "typography" && typeof tok.$value === "object") {
          const o = tok.$value as Record<string, unknown>;
          const fs = o["fontSize"];
          const ff = o["fontFamily"];
          const fw = o["fontWeight"];
          const fsVal =
            typeof fs === "number" ? fs : parseFloat(String(fs)) || 16;
          const w =
            typeof fw === "string" && fw.length > 0
              ? `FontWeight.${fw[0]!.toUpperCase()}${fw.slice(1)}`
              : "FontWeight.Normal";
          const fam =
            typeof ff === "string" && ff.length > 0
              ? `FontFamily("${ff.replace(/"/g, "")}")`
              : "FontFamily.SansSerif";
          lines.push(
            `  val ${tok.name} = TextStyle(`,
            `    fontSize = ${fsVal}.sp,`,
            `    fontWeight = ${w},`,
            `    fontFamily = ${fam},`,
            `  )`,
            "",
          );
          continue;
        }
        if ($type === "fontWeight" || $type === "number") {
          const n = Number(tok.$value);
          if (Number.isFinite(n)) {
            lines.push(
              `  val ${tok.name} = TextStyle(fontSize = ${n}.sp)`,
              "",
            );
          }
        } else if ($type === "fontFamily") {
          const str = Array.isArray(tok.$value) ? tok.$value[0] : tok.$value;
          if (typeof str === "string") {
            lines.push(
              `  val ${tok.name} = TextStyle(fontFamily = FontFamily("${str.replace(/"/g, "")}"))`,
              "",
            );
          }
        }
      }
      lines.push("}");
      return header + lines.join("\n") + "\n";
    },
  });

  androidHooksRegistered = true;
}

const ANDROID_TRANSFORMS_BASE: string[] = [
  "attribute/cti",
  ANDROID_XML_NAME,
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

const ANDROID_COMPOSE_TRANSFORMS: string[] = [
  "attribute/cti",
  ANDROID_COMPOSE_NAME,
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

function createAndroidXmlStyleDictionary(
  outputDir: string,
  themeName: string,
  buildPath: string,
  fileFilter?: (t: TokenLike) => boolean,
): InstanceType<typeof StyleDictionary> {
  ensureAndroidHooksRegistered();
  const source = [
    toPosix(join(outputDir, "tokens", "primitive", "**/*.json")),
    toPosix(join(outputDir, "tokens", "semantic", themeName, "**/*.json")),
    toPosix(join(outputDir, "tokens", "component", "**/*.json")),
  ];
  const combined = fileFilter
    ? (t: TokenLike) => {
        if (!fileFilter(t)) return false;
        return isColorCategory(t) || isSpacingCategory(t) || isTypographyCategory(t);
      }
    : (t: TokenLike) =>
        isColorCategory(t) || isSpacingCategory(t) || isTypographyCategory(t);

  return new StyleDictionary({
    source,
    usesDtcg: true,
    log: silenceLogs(),
    platforms: {
      android: {
        prefix: PREFIX,
        transforms: ANDROID_TRANSFORMS_BASE,
        buildPath: toPosix(buildPath) + "/",
        files: [
          {
            destination: "colors.xml",
            format: ANDROID_COLORS_XML,
            filter: (t) => combined(t) && isColorCategory(t),
          },
          {
            destination: "dimens.xml",
            format: ANDROID_DIMENS_XML,
            filter: (t) => combined(t) && isSpacingCategory(t),
          },
          {
            destination: "typography_dimens.xml",
            format: ANDROID_TYPOGRAPHY_DIMENS_XML,
            filter: (t) => combined(t) && isTypographyCategory(t) && (t as { $type?: string }).$type !== "fontFamily",
          },
          {
            destination: "typography_strings.xml",
            format: ANDROID_TYPOGRAPHY_STRINGS_XML,
            filter: (t) => combined(t) && isTypographyCategory(t) && (t as { $type?: string }).$type === "fontFamily",
          },
        ],
      },
    },
  });
}

function createAndroidComposeStyleDictionary(
  outputDir: string,
  themeName: string,
  buildPath: string,
): InstanceType<typeof StyleDictionary> {
  ensureAndroidHooksRegistered();
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
      android: {
        transforms: ANDROID_COMPOSE_TRANSFORMS,
        buildPath: toPosix(buildPath) + "/",
        files: [
          {
            destination: "Color.kt",
            format: ANDROID_COLOR_COMPOSE,
            filter: (t: TokenLike) => isColorCategory(t),
          },
          {
            destination: "Spacing.kt",
            format: ANDROID_SPACING_COMPOSE,
            filter: (t: TokenLike) => isSpacingCategory(t),
          },
          {
            destination: "Typography.kt",
            format: ANDROID_TYPOGRAPHY_COMPOSE,
            filter: (t: TokenLike) => isTypographyCategory(t),
          },
        ],
      },
    },
  });
}

function findLightDarkThemes(
  themes: ReadonlyArray<{ name: string }>,
): { light: string; dark: string } {
  const names = themes.map((t) => t.name);
  const darkN = names.find((n) => n === "dark");
  const lightN = names.find((n) => n === "light");
  if (lightN && darkN) {
    return { light: lightN, dark: darkN };
  }
  if (themes.length >= 2) {
    return { light: names[0]!, dark: names[1]! };
  }
  return { light: names[0]!, dark: names[0]! };
}

function extractValLinesInKotlinObject(
  fileContent: string,
  objectName: string,
): string[] {
  const esc = objectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startRe = new RegExp(`^\\s*object\\s+${esc}\\b\\s*\\{`);
  const lines = fileContent.split("\n");
  let i = 0;
  for (; i < lines.length; i++) {
    if (startRe.test(lines[i]!)) break;
  }
  if (i >= lines.length) return [];
  i++;
  let depth = 1;
  const out: string[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const t = line.trim();
    if (t.startsWith("val ") && t.includes("=")) {
      out.push(t);
    }
    const open = (line.match(/\{/g) ?? []).length;
    const close = (line.match(/\}/g) ?? []).length;
    depth += open - close;
    if (depth <= 0) {
      break;
    }
  }
  return out;
}

type ThemeOut = { color: string; spacing: string; typo: string };
type MergeKind = "QuietoColors" | "QuietoSpacing" | "QuietoTypography";

function buildMergedThemeObjects(
  themes: { name: string }[],
  themeOutputs: Map<string, ThemeOut>,
  kind: MergeKind,
  headerImports: string,
  rootObjectName: string,
): string {
  let body = `${headerImports}\n\nobject ${rootObjectName} {\n`;
  for (const t of themes) {
    const out = themeOutputs.get(t.name);
    if (!out) continue;
    const raw =
      kind === "QuietoColors"
        ? out.color
        : kind === "QuietoSpacing"
          ? out.spacing
          : out.typo;
    const members = extractValLinesInKotlinObject(raw, kind);
    if (members.length === 0) continue;
    const enumName = t.name.charAt(0).toUpperCase() + t.name.slice(1);
    body += `  object ${enumName} {\n`;
    for (const line of members) {
      body += `    ${line}\n`;
    }
    body += `  }\n`;
  }
  body += "}\n";
  return body;
}

function firstKotlinColorValName(
  fileContent: string,
  objectName: string,
): string {
  for (const line of extractValLinesInKotlinObject(fileContent, objectName)) {
    const m = line.match(/^val (\w+) =/);
    if (m) return m[1] ?? "";
  }
  return "Blue500";
}

function appendColorSchemeBridges(
  colorKtBody: string,
  themes: { name: string }[],
  themeOutputs: Map<string, ThemeOut>,
): string {
  const ld = findLightDarkThemes(themes);
  const light = themeOutputs.get(ld.light)?.color ?? "";
  const dark = themeOutputs.get(ld.dark)?.color ?? "";
  if (!light || !dark || themes.length < 2) {
    return colorKtBody;
  }
  const lName = firstKotlinColorValName(light, "QuietoColors");
  const dName = firstKotlinColorValName(dark, "QuietoColors");
  const lE = ld.light.charAt(0).toUpperCase() + ld.light.slice(1);
  const dE = ld.dark.charAt(0).toUpperCase() + ld.dark.slice(1);
  const mImports =
    `import androidx.compose.material3.ColorScheme\n` +
    `import androidx.compose.material3.darkColorScheme\n` +
    `import androidx.compose.material3.lightColorScheme\n`;
  const bridge =
    `\nval quietoLightColorScheme: ColorScheme = lightColorScheme(\n` +
    `  primary = ThemeColors.${lE}.${lName},\n` +
    `)\n` +
    `val quietoDarkColorScheme: ColorScheme = darkColorScheme(\n` +
    `  primary = ThemeColors.${dE}.${dName},\n` +
    `)\n`;
  if (colorKtBody.includes("androidx.compose.material3.lightColorScheme")) {
    return colorKtBody + bridge;
  }
  if (/^package [^\n]+\n/m.test(colorKtBody)) {
    return colorKtBody.replace(
      /^(package [^\n]+)\n/m,
      `$1\n${mImports}\n`,
    ) + bridge;
  }
  return mImports + "\n" + colorKtBody + bridge;
}

export async function buildAndroid(
  collection: ThemeCollection,
  outputDir: string,
  format: "xml" | "compose",
): Promise<string[]> {
  const base = join(outputDir, "build", "android");
  const themes = collection.themes;
  if (format === "xml") {
    if (themes.length === 1) {
      const p = join(base, "values");
      await mkdir(p, { recursive: true });
      const sd = createAndroidXmlStyleDictionary(
        outputDir,
        themes[0]!.name,
        p,
      );
      await sd.buildAllPlatforms();
    } else {
      const { light, dark } = findLightDarkThemes(themes);
      const valuesDir = join(base, "values");
      const nightDir = join(base, "values-night");
      await mkdir(valuesDir, { recursive: true });
      await mkdir(nightDir, { recursive: true });
      const sdL = createAndroidXmlStyleDictionary(
        outputDir,
        light,
        valuesDir,
      );
      await sdL.buildAllPlatforms();
      const sdN = createAndroidXmlStyleDictionary(
        outputDir,
        dark,
        nightDir,
        (t) => isSemanticOrComponentToken(t),
      );
      await sdN.buildAllPlatforms();
    }
    return collectExistingPaths([
      join(base, "values", "colors.xml"),
      join(base, "values", "dimens.xml"),
      join(base, "values", "typography_dimens.xml"),
      join(base, "values", "typography_strings.xml"),
      join(base, "values-night", "colors.xml"),
      join(base, "values-night", "dimens.xml"),
      join(base, "values-night", "typography_dimens.xml"),
      join(base, "values-night", "typography_strings.xml"),
    ]);
  }
  if (themes.length === 1) {
    const sd = createAndroidComposeStyleDictionary(
      outputDir,
      themes[0]!.name,
      base,
    );
    await sd.buildAllPlatforms();
    return collectExistingPaths([
      join(base, "Color.kt"),
      join(base, "Spacing.kt"),
      join(base, "Typography.kt"),
    ]);
  }
  const themeOutputs = new Map<string, ThemeOut>();
  for (const th of themes) {
    const sd = createAndroidComposeStyleDictionary(outputDir, th.name, base);
    const parts = await sd.formatPlatform("android");
    const mapped: Record<string, string> = Object.create(null);
    for (const part of parts) {
      const dest = (part.destination ?? "").split("/").pop() ?? "";
      mapped[dest] = typeof part.output === "string" ? part.output : "";
    }
    themeOutputs.set(th.name, {
      color: mapped["Color.kt"] ?? "",
      spacing: mapped["Spacing.kt"] ?? "",
      typo: mapped["Typography.kt"] ?? "",
    });
  }
  await mkdir(base, { recursive: true });
  const colorH = `// Do not edit directly; auto-generated.
package com.quieto.tokens
import androidx.compose.ui.graphics.Color`;
  const spH = `// Do not edit directly; auto-generated.
package com.quieto.tokens
import androidx.compose.ui.unit.dp`;
  const tyH = `// Do not edit directly; auto-generated.
package com.quieto.tokens
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp`;
  let colorMerged = buildMergedThemeObjects(
    themes,
    themeOutputs,
    "QuietoColors",
    colorH,
    "ThemeColors",
  );
  colorMerged = appendColorSchemeBridges(
    colorMerged,
    themes,
    themeOutputs,
  );
  const spMerged = buildMergedThemeObjects(
    themes,
    themeOutputs,
    "QuietoSpacing",
    spH,
    "ThemeSpacing",
  );
  const tyMerged = buildMergedThemeObjects(
    themes,
    themeOutputs,
    "QuietoTypography",
    tyH,
    "ThemeTypography",
  );
  const written: string[] = [];
  for (const [name, content] of [
    ["Color.kt", colorMerged],
    ["Spacing.kt", spMerged],
    ["Typography.kt", tyMerged],
  ] as const) {
    if (content.length > 0 && /val /.test(content)) {
      const fp = join(base, name);
      await writeFile(fp, content, "utf-8");
      written.push(fp);
    }
  }
  return written;
}

async function collectExistingPaths(paths: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const p of paths) {
    try {
      await stat(p);
      out.push(p);
    } catch {
      // Style Dictionary may omit a file if filter matched no tokens
    }
  }
  return out;
}
