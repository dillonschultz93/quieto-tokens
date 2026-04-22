import { join } from "node:path";
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
