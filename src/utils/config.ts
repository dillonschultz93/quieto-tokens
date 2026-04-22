import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as p from "@clack/prompts";
import type { QuietoConfig } from "../types/config.js";
import { DEFAULT_CATEGORIES } from "../types/config.js";
import { validateComponentName } from "./validation.js";
import {
  SHADOW_MAX_LEVELS,
  SHADOW_MIN_LEVELS,
} from "../generators/shadow.js";
import { DTCG_COLOR_REF_RE, INPUT_LIMITS } from "./defaults.js";

export const CONFIG_FILENAME = "quieto.config.json";

export function getConfigPath(cwd: string = process.cwd()): string {
  return resolve(cwd, CONFIG_FILENAME);
}

/**
 * Report whether a readable `quieto.config.json` exists under `cwd`.
 *
 * Distinguishes ENOENT ("no config, first run") from other I/O errors
 * ("config is there but we can't touch it — permissions, is-a-directory,
 * etc."). The latter bubble up as `true` so the caller can route through
 * {@link loadConfig}, which surfaces the real error to the user instead of
 * silently treating a locked file as a missing one.
 */
export function configExists(cwd: string = process.cwd()): boolean {
  try {
    readFileSync(getConfigPath(cwd), "utf-8");
    return true;
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return false;
    }
    // Any other read error (EACCES, EISDIR, EPERM, …) means "config is
    // present but unreadable" — treat it as existing so the load path can
    // surface a proper error instead of pretending this is a fresh run.
    return true;
  }
}

function isErrnoException(value: unknown): value is NodeJS.ErrnoException {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code?: unknown }).code === "string"
  );
}

/**
 * Minimal structured-warning surface `loadConfig` emits its advisory
 * messages through. Production callers should inject a Clack-backed logger
 * (`{ warn: p.log.warn }`); tests inject a spy.
 *
 * The default logger routes through Clack's `p.log.warn` so warnings
 * surface as proper steps in the UI instead of bare `console.warn`
 * output (Dev Notes: "Clack is the only user-facing I/O").
 */
export interface ConfigLogger {
  warn: (message: string) => void;
}

export interface LoadConfigOptions {
  /**
   * The current tool version. When provided, `loadConfig` emits a warning
   * via the injected `logger` if the file records a *newer* version than
   * the running tool (forward-incompatible scenario). Falsy/missing →
   * skip the check.
   */
  toolVersion?: string;
  /** Warning sink. Defaults to Clack's `p.log.warn`. */
  logger?: ConfigLogger;
}

/**
 * Discriminated result type for {@link loadConfig}. Callers can distinguish
 * between "no config yet", "file present but we can't parse it", "parsed but
 * structurally wrong", and "happy path" — each demands a different UX
 * response in the modify-vs-fresh flow (Story 2.1).
 */
export type LoadConfigResult =
  | { status: "missing" }
  | { status: "corrupt"; error: Error }
  | { status: "invalid"; errors: string[] }
  | { status: "ok"; config: QuietoConfig };

/**
 * Clack-backed default logger. Uses `p.log.warn` so warnings render as
 * framed steps in an interactive session. `p.log.warn` is safe to call
 * in non-TTY contexts — it just prints a formatted line to stderr.
 */
const DEFAULT_LOGGER: ConfigLogger = {
  warn: (message) => p.log.warn(message),
};

/**
 * Compare two dot-separated semver-like version strings. Returns a negative
 * number if `a < b`, positive if `a > b`, `0` if equal. Non-numeric segments
 * and trailing pre-release tags are ignored — this is deliberately coarse so
 * a generated config is only flagged when the numeric major/minor/patch is
 * strictly higher than the tool's own version.
 */
function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v
      .split("-")[0]!
      .split(".")
      .map((segment) => {
        const n = Number.parseInt(segment, 10);
        return Number.isFinite(n) ? n : 0;
      });

  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Structurally validate a parsed unknown against the schema. Returns a list
 * of dotted paths whose value is missing or of the wrong type; empty list
 * means the value conforms.
 *
 * Covers:
 * - Epic 1 required fields (version/inputs/overrides/output).
 * - Epic 2 additions that are optional on disk but type-checked when present
 *   (`categories` must be `string[]`; `advanced.spacing.customValues` entries
 *   must be finite positive numbers).
 */
export function validateConfigShape(parsed: unknown): string[] {
  const errors: string[] = [];

  if (typeof parsed !== "object" || parsed === null) {
    return ["<root>: expected object"];
  }

  const root = parsed as Record<string, unknown>;

  if (typeof root.version !== "string") errors.push("version");
  if (typeof root.generated !== "string") errors.push("generated");

  const inputs = root.inputs;
  if (typeof inputs !== "object" || inputs === null) {
    errors.push("inputs");
  } else {
    const i = inputs as Record<string, unknown>;
    if (typeof i.brandColor !== "string") errors.push("inputs.brandColor");
    if (i.spacingBase !== 4 && i.spacingBase !== 8) {
      errors.push("inputs.spacingBase");
    }
    if (
      i.typeScale !== "compact" &&
      i.typeScale !== "balanced" &&
      i.typeScale !== "spacious"
    ) {
      errors.push("inputs.typeScale");
    }
    if (typeof i.darkMode !== "boolean") errors.push("inputs.darkMode");
  }

  if (
    typeof root.overrides !== "object" ||
    root.overrides === null ||
    Array.isArray(root.overrides)
  ) {
    errors.push("overrides");
  }

  const output = root.output;
  if (typeof output !== "object" || output === null) {
    errors.push("output");
  } else {
    const o = output as Record<string, unknown>;
    if (typeof o.tokensDir !== "string") errors.push("output.tokensDir");
    if (typeof o.buildDir !== "string") errors.push("output.buildDir");
    if (typeof o.prefix !== "string") errors.push("output.prefix");
  }

  // Epic 2 optional fields — only validated when present.
  if (root.categories !== undefined) {
    if (!Array.isArray(root.categories)) {
      errors.push("categories");
    } else {
      for (let i = 0; i < root.categories.length; i++) {
        if (typeof root.categories[i] !== "string") {
          errors.push(`categories[${i}]`);
        }
      }
    }
  }

  if (root.advanced !== undefined) {
    if (
      typeof root.advanced !== "object" ||
      root.advanced === null ||
      Array.isArray(root.advanced)
    ) {
      errors.push("advanced");
    } else {
      const advanced = root.advanced as Record<string, unknown>;
      const spacing = advanced.spacing;
      if (spacing !== undefined) {
        if (typeof spacing !== "object" || spacing === null) {
          errors.push("advanced.spacing");
        } else {
          const custom = (spacing as Record<string, unknown>).customValues;
          if (custom !== undefined) {
            if (
              typeof custom !== "object" ||
              custom === null ||
              Array.isArray(custom)
            ) {
              errors.push("advanced.spacing.customValues");
            } else {
              for (const [key, value] of Object.entries(
                custom as Record<string, unknown>,
              )) {
                if (
                  typeof value !== "number" ||
                  !Number.isFinite(value) ||
                  value <= 0
                ) {
                  errors.push(`advanced.spacing.customValues.${key}`);
                }
              }
            }
          }
        }
      }
    }
  }

  if (root.categoryConfigs !== undefined) {
    validateCategoryConfigs(root.categoryConfigs, errors);
  }

  if (root.components !== undefined) {
    validateComponents(root.components, errors);
  }

  return errors;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

/**
 * Validate a positive-integer array with a shared ceiling and entry-count
 * cap. The cap matches the interactive prompts in `src/commands/add-*.ts`
 * so a hand-edited config can't smuggle values the prompts would reject.
 * Empty arrays are an error: a `widths: []` or `durations: []` that passed
 * validation silently produced a category registered with zero tokens.
 */
function validateIntArray(
  values: unknown,
  path: string,
  errors: string[],
  maxValue: number,
): void {
  if (!Array.isArray(values)) {
    errors.push(path);
    return;
  }
  if (values.length === 0) {
    errors.push(`${path}: must not be empty`);
    return;
  }
  if (values.length > INPUT_LIMITS.maxEntries) {
    errors.push(
      `${path}: too many entries (max ${INPUT_LIMITS.maxEntries})`,
    );
  }
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      !Number.isInteger(v) ||
      v <= 0 ||
      v > maxValue
    ) {
      errors.push(`${path}[${i}]`);
    }
  }
}

/**
 * Known keys under `categoryConfigs`. Any other key (typo, a future
 * category this tool version doesn't understand, or a malicious
 * `__proto__`) is rejected so round-tripping a loaded config can't
 * preserve unknown data silently.
 */
const KNOWN_CATEGORY_CONFIG_KEYS: ReadonlySet<string> = new Set([
  "shadow",
  "border",
  "animation",
]);

function validateCategoryConfigs(
  value: unknown,
  errors: string[],
): void {
  if (!isPlainObject(value)) {
    errors.push("categoryConfigs");
    return;
  }

  for (const key of Object.keys(value)) {
    if (!KNOWN_CATEGORY_CONFIG_KEYS.has(key)) {
      errors.push(`categoryConfigs.${key}: unknown key`);
    }
  }

  if (value.shadow !== undefined) {
    validateShadowCategoryConfig(value.shadow, errors);
  }
  if (value.border !== undefined) {
    validateBorderCategoryConfig(value.border, errors);
  }
  if (value.animation !== undefined) {
    validateAnimationCategoryConfig(value.animation, errors);
  }
}

const SHADOW_CATEGORY_CONFIG_KEYS = new Set([
  "levels",
  "colorRef",
  "profile",
]);

function validateShadowCategoryConfig(
  value: unknown,
  errors: string[],
): void {
  if (!isPlainObject(value)) {
    errors.push("categoryConfigs.shadow");
    return;
  }
  for (const key of Object.keys(value)) {
    if (!SHADOW_CATEGORY_CONFIG_KEYS.has(key)) {
      errors.push(`categoryConfigs.shadow.${key}: unknown key`);
    }
  }
  const levels = value.levels;
  if (
    typeof levels !== "number" ||
    !Number.isFinite(levels) ||
    !Number.isInteger(levels) ||
    levels < SHADOW_MIN_LEVELS ||
    levels > SHADOW_MAX_LEVELS
  ) {
    errors.push("categoryConfigs.shadow.levels");
  }
  if (typeof value.colorRef !== "string" || value.colorRef.length === 0) {
    errors.push("categoryConfigs.shadow.colorRef");
  } else if (!DTCG_COLOR_REF_RE.test(value.colorRef)) {
    // Reject refs whose shape the generator can't honour. The schema
    // can't check whether the referenced hue/step actually exists —
    // that's the interactive prompt's job, backed by the generated
    // color primitives — but it can at least keep `{foo.bar}` or
    // whitespace from reaching `generateShadowPrimitives`.
    errors.push("categoryConfigs.shadow.colorRef");
  }
  if (value.profile !== "soft" && value.profile !== "hard") {
    errors.push("categoryConfigs.shadow.profile");
  }
}

const BORDER_CATEGORY_CONFIG_KEYS = new Set(["widths", "radii", "pill"]);

function validateBorderCategoryConfig(
  value: unknown,
  errors: string[],
): void {
  if (!isPlainObject(value)) {
    errors.push("categoryConfigs.border");
    return;
  }
  for (const key of Object.keys(value)) {
    if (!BORDER_CATEGORY_CONFIG_KEYS.has(key)) {
      errors.push(`categoryConfigs.border.${key}: unknown key`);
    }
  }
  validateIntArray(
    value.widths,
    "categoryConfigs.border.widths",
    errors,
    INPUT_LIMITS.maxPixelSize,
  );
  validateIntArray(
    value.radii,
    "categoryConfigs.border.radii",
    errors,
    INPUT_LIMITS.maxPixelSize,
  );
  // `pill` is new in D1 and optional on disk for Story 2.1 configs that
  // never saw a border block (they simply won't have one). When
  // present it must be a boolean — a string "true" wouldn't fly.
  if (value.pill !== undefined && typeof value.pill !== "boolean") {
    errors.push("categoryConfigs.border.pill");
  }
}

const ANIMATION_CATEGORY_CONFIG_KEYS = new Set(["durations", "easing"]);

function validateAnimationCategoryConfig(
  value: unknown,
  errors: string[],
): void {
  if (!isPlainObject(value)) {
    errors.push("categoryConfigs.animation");
    return;
  }
  for (const key of Object.keys(value)) {
    if (!ANIMATION_CATEGORY_CONFIG_KEYS.has(key)) {
      errors.push(`categoryConfigs.animation.${key}: unknown key`);
    }
  }
  validateIntArray(
    value.durations,
    "categoryConfigs.animation.durations",
    errors,
    INPUT_LIMITS.maxDurationMs,
  );
  if (
    value.easing !== "standard" &&
    value.easing !== "emphasized" &&
    value.easing !== "decelerated"
  ) {
    errors.push("categoryConfigs.animation.easing");
  }
}

const VALID_COMPONENT_PROPERTIES: ReadonlySet<string> = new Set([
  "color-background",
  "color-content",
  "color-border",
  "spacing-padding",
  "border-radius",
  "typography",
]);

const VALID_COMPONENT_STATES: ReadonlySet<string> = new Set([
  "default",
  "hover",
  "active",
  "focus",
  "disabled",
]);

const DTCG_REF_RE = /^\{[a-z][a-z0-9.-]*\}$/;

function isDtcgRef(value: unknown): boolean {
  return typeof value === "string" && DTCG_REF_RE.test(value);
}

function validateComponents(value: unknown, errors: string[]): void {
  if (!isPlainObject(value)) {
    errors.push("components");
    return;
  }

  for (const [name, entry] of Object.entries(value)) {
    const nameError = validateComponentName(name);
    if (nameError) {
      errors.push(`components.${name}: invalid component name`);
    }
    if (!isPlainObject(entry)) {
      errors.push(`components.${name}`);
      continue;
    }

    const prefix = `components.${name}`;

    if (!Array.isArray(entry.variants) || entry.variants.length === 0) {
      errors.push(`${prefix}.variants`);
    } else {
      for (let i = 0; i < entry.variants.length; i++) {
        const v = entry.variants[i];
        if (typeof v !== "string") {
          errors.push(`${prefix}.variants[${i}]`);
        } else if (v !== v.trim()) {
          // Whitespace-padded variant strings are invalid in config files — enforce
          // pre-trimmed values so the variants Set matches cell.variant exactly.
          errors.push(`${prefix}.variants[${i}]`);
        } else {
          const vErr = validateComponentName(v);
          if (vErr && v !== "default") {
            errors.push(`${prefix}.variants[${i}]`);
          }
        }
      }
    }

    if (!Array.isArray(entry.cells)) {
      errors.push(`${prefix}.cells`);
      continue;
    }

    const variants = Array.isArray(entry.variants)
      ? new Set(entry.variants as unknown[])
      : new Set<unknown>();

    for (let ci = 0; ci < entry.cells.length; ci++) {
      const cell = entry.cells[ci];
      const cp = `${prefix}.cells[${ci}]`;

      if (!isPlainObject(cell)) {
        errors.push(cp);
        continue;
      }

      if (
        typeof cell.variant !== "string" ||
        cell.variant !== cell.variant.trim() ||
        !variants.has(cell.variant)
      ) {
        errors.push(`${cp}.variant`);
      }

      if (
        typeof cell.property !== "string" ||
        !VALID_COMPONENT_PROPERTIES.has(cell.property)
      ) {
        errors.push(`${cp}.property`);
      }

      if (
        cell.paddingShape !== undefined &&
        cell.paddingShape !== "single" &&
        cell.paddingShape !== "four-sides"
      ) {
        errors.push(`${cp}.paddingShape`);
      }

      if (
        cell.paddingShape !== undefined &&
        cell.property !== "spacing-padding"
      ) {
        errors.push(`${cp}.paddingShape: only valid for spacing-padding`);
      }

      if (!Array.isArray(cell.states) || cell.states.length === 0) {
        errors.push(`${cp}.states`);
        continue;
      }

      const seenStates = new Set<string>();
      let hasDefault = false;
      for (let si = 0; si < cell.states.length; si++) {
        const stateEntry = cell.states[si];
        const sp = `${cp}.states[${si}]`;

        if (!isPlainObject(stateEntry)) {
          errors.push(sp);
          continue;
        }

        if (
          typeof stateEntry.state !== "string" ||
          !VALID_COMPONENT_STATES.has(stateEntry.state)
        ) {
          errors.push(`${sp}.state`);
        } else {
          if (stateEntry.state === "default") hasDefault = true;
          if (seenStates.has(stateEntry.state as string)) {
            errors.push(`${sp}.state: duplicate state`);
          }
          seenStates.add(stateEntry.state as string);
        }

        const val = stateEntry.value;
        if (typeof val === "string") {
          if (!isDtcgRef(val)) {
            errors.push(`${sp}.value`);
          }
        } else if (isPlainObject(val)) {
          for (const side of ["top", "right", "bottom", "left"] as const) {
            if (!isDtcgRef(val[side])) {
              errors.push(`${sp}.value.${side}`);
            }
          }
        } else {
          errors.push(`${sp}.value`);
        }
      }

      if (!hasDefault) {
        errors.push(`${cp}.states: must include a default state`);
      }
    }
  }
}

/**
 * Read, parse, and validate an existing `quieto.config.json` from the given
 * directory. Returns a {@link LoadConfigResult} discriminating between the
 * four possible outcomes.
 *
 * Epic 1 configs — written before the schema grew `categories` and
 * `advanced` — are accepted: the returned `config.categories` defaults to
 * {@link DEFAULT_CATEGORIES} and `config.advanced` is left `undefined`. The
 * on-disk file is NOT mutated; legacy configs migrate forward on their next
 * write.
 *
 * When {@link LoadConfigOptions.toolVersion} is supplied and the config's
 * `version` is newer than the tool's, a warning is emitted via
 * `options.logger` (defaulting to Clack's `p.log.warn`). The config is still
 * returned as `"ok"` — the caller decides whether to proceed.
 */
export function loadConfig(
  cwd: string = process.cwd(),
  options: LoadConfigOptions = {},
): LoadConfigResult {
  const filePath = getConfigPath(cwd);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return { status: "missing" };
    }
    // Other read errors (EACCES, EISDIR, …) present as corruption to the
    // caller — the file is there, but we can't get at it. Distinguishing
    // further would bloat the surface without a user-facing benefit.
    return {
      status: "corrupt",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  // Strip a leading UTF-8 BOM (some Windows editors save JSON with one);
  // JSON.parse rejects it but the file is otherwise valid.
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      status: "corrupt",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  const errors = validateConfigShape(parsed);
  if (errors.length > 0) {
    return { status: "invalid", errors };
  }

  // Structural validation passed. Copy known fields explicitly — NEVER
  // spread the parsed JSON root, since attacker-controlled keys like
  // `__proto__` or `constructor` would pollute the returned object's
  // prototype chain (CVE-pattern). An explicit field copy is the only
  // safe way to promote an untrusted record to our typed shape.
  const root = parsed as Record<string, unknown>;
  const rawCategories = root.categories;
  const config: QuietoConfig = {
    version: root.version as string,
    generated: root.generated as string,
    inputs: { ...(root.inputs as QuietoConfig["inputs"]) },
    overrides: { ...(root.overrides as QuietoConfig["overrides"]) },
    output: { ...(root.output as QuietoConfig["output"]) },
    categories: Array.isArray(rawCategories)
      ? (rawCategories as string[]).slice()
      : [...DEFAULT_CATEGORIES],
  };
  if (typeof root.$schema === "string") config.$schema = root.$schema;
  if (root.advanced !== undefined) {
    // `advanced` passed structural validation above; deep-clone via
    // JSON round-trip so the returned object is independent of the
    // parsed tree. JSON.parse(JSON.stringify(...)) produces a plain
    // prototype-free tree for any object that already round-trips
    // through JSON (which `parsed` did, by definition).
    config.advanced = JSON.parse(
      JSON.stringify(root.advanced),
    ) as QuietoConfig["advanced"];
  }
  if (root.categoryConfigs !== undefined) {
    config.categoryConfigs = JSON.parse(
      JSON.stringify(root.categoryConfigs),
    ) as QuietoConfig["categoryConfigs"];
  }
  if (root.components !== undefined) {
    config.components = JSON.parse(
      JSON.stringify(root.components),
    ) as QuietoConfig["components"];
  }

  const logger = options.logger ?? DEFAULT_LOGGER;
  if (
    options.toolVersion &&
    compareVersions(config.version, options.toolVersion) > 0
  ) {
    // A throwing logger must not break the discriminated-union contract
    // — swallow the failure so callers always get a `LoadConfigResult`.
    try {
      logger.warn(
        `quieto.config.json was generated by a newer version of quieto-tokens (${config.version}) than the one currently installed (${options.toolVersion}). Some fields may not be understood.`,
      );
    } catch {
      // Intentionally ignored; the warning is advisory.
    }
  }

  return { status: "ok", config };
}
