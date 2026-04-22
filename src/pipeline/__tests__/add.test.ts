import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { QuietoConfig } from "../../types/config.js";

/**
 * Full-stack add-pipeline smoke test — Story 2.4 Tasks 1.5 + 4.1.
 *
 * These tests exercise `runAdd` against a real tmp-dir fixture with a
 * pre-seeded init-like state on disk, asserting:
 *
 * 1. (AC #1) `add <category>` only (re)writes that category's primitive
 *    + per-theme semantic JSON — every other category file's mtime is
 *    unchanged. This is the D5 refactor's regression guard.
 *
 * 2. (AC #2) CSS is rebuilt by re-sourcing from the on-disk JSON tree,
 *    so `build/*.css` reflects the union of pre-existing + newly-added
 *    categories even though the in-memory collection only drives the
 *    single-category write.
 *
 * 3. (Task 4) The full on-disk output tree is correct after a run, and
 *    the `categoryConfigs` block round-trips through the writer.
 */

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  note: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
}));

import * as p from "@clack/prompts";
import { runAdd } from "../add.js";
import { runColorGeneration } from "../color.js";
import {
  runSpacingGeneration,
  runTypographyGeneration,
} from "../spacing-typography.js";
import {
  generateSemanticTokens,
  mapShadowSemantics,
} from "../../mappers/semantic.js";
import { generateThemes } from "../../generators/themes.js";
import { generateShadowPrimitives } from "../../generators/shadow.js";
import { writeTokensToJson } from "../../output/json-writer.js";
import type { ShadowCategoryConfig } from "../../types/config.js";

function baseConfig(
  overrides: Partial<QuietoConfig> = {},
): QuietoConfig {
  return {
    version: "0.1.0",
    generated: "2026-04-17T12:00:00.000Z",
    inputs: {
      brandColor: "#3B82F6",
      spacingBase: 8,
      typeScale: "balanced",
      darkMode: true,
    },
    overrides: {},
    output: { tokensDir: "tokens", buildDir: "build", prefix: "quieto" },
    categories: ["color", "spacing", "typography"],
    ...overrides,
  };
}

/**
 * Pre-seed the tmp directory with a complete init-equivalent on-disk
 * state: every core primitive + semantic JSON file. This simulates the
 * post-`init` world that `add` walks into — it's the only honest way
 * to test mtime stability, because `runAdd` must find existing files
 * on disk to leave alone.
 *
 * Pass `priorShadow` to additionally seed a shadow primitive + per-theme
 * semantic — the exact scenario AC #1 demands ("at least one added
 * category on disk").
 */
async function seedInitState(
  cwd: string,
  config: QuietoConfig,
  options: { priorShadow?: ShadowCategoryConfig } = {},
): Promise<void> {
  const corePrimitives = [
    ...(await runColorGeneration(config.inputs.brandColor, config.advanced?.color)),
    ...runSpacingGeneration(config.inputs.spacingBase, config.advanced?.spacing),
    ...runTypographyGeneration(
      config.inputs.typeScale,
      config.advanced?.typography,
    ),
  ];
  const semantics = generateSemanticTokens(corePrimitives);
  const collection = generateThemes(semantics, corePrimitives, config.inputs.darkMode);

  if (options.priorShadow) {
    const shadowPrimitives = generateShadowPrimitives(options.priorShadow);
    const shadowSemantics = mapShadowSemantics(shadowPrimitives);
    collection.primitives.push(...shadowPrimitives);
    for (const theme of collection.themes) {
      theme.semanticTokens = [...theme.semanticTokens, ...shadowSemantics];
    }
  }

  await writeTokensToJson(collection, cwd, {
    generatedAt: "2026-04-17T12:00:00.000Z",
  });
}

function collectMtimes(paths: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const path of paths) {
    out[path] = statSync(path).mtimeMs;
  }
  return out;
}

describe("runAdd — pipeline E2E", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-add-e2e-"));
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("only rewrites the added category's JSON — core + prior-added shadow files keep their mtimes (AC #1)", async () => {
    const priorShadow: ShadowCategoryConfig = {
      levels: 3,
      profile: "soft",
      colorRef: "{color.neutral.900}",
    };
    const config = baseConfig({
      categories: ["color", "spacing", "typography", "shadow"],
      categoryConfigs: { shadow: priorShadow },
    });
    await seedInitState(tempDir, config, { priorShadow });

    // The core primitive + semantic files AND the pre-existing shadow
    // primitive + semantic files (the story's "at least one added
    // category on disk" clause) must all be stable across the
    // `add border` run. Listing each file explicitly makes any future
    // seeding change break this test loudly.
    const stableFiles = [
      join(tempDir, "tokens", "primitive", "color.json"),
      join(tempDir, "tokens", "primitive", "spacing.json"),
      join(tempDir, "tokens", "primitive", "typography.json"),
      join(tempDir, "tokens", "primitive", "shadow.json"),
      join(tempDir, "tokens", "semantic", "light", "color.json"),
      join(tempDir, "tokens", "semantic", "light", "spacing.json"),
      join(tempDir, "tokens", "semantic", "light", "shadow.json"),
      join(tempDir, "tokens", "semantic", "dark", "color.json"),
      join(tempDir, "tokens", "semantic", "dark", "spacing.json"),
      join(tempDir, "tokens", "semantic", "dark", "shadow.json"),
    ];
    for (const file of stableFiles) {
      expect(existsSync(file)).toBe(true);
    }
    const seedMtimes = collectMtimes(stableFiles);

    // Prompts for `collectBorderInputs`: widths (text), radii (text),
    // pill (confirm). Use the default ramps so the generator stays in
    // its happy path.
    vi.mocked(p.text)
      .mockResolvedValueOnce("1,2,4,8")
      .mockResolvedValueOnce("2,4,8,16");
    vi.mocked(p.confirm).mockResolvedValueOnce(false);

    // Bump clock forward past fs mtime resolution (APFS = 1ns, but some
    // filesystems coalesce to 1s) so any incidental rewrite would land
    // with a newer mtime than the seed.
    await new Promise((r) => setTimeout(r, 20));

    const outcome = await runAdd("border", config, tempDir);
    expect(outcome.status).toBe("ok");

    // Border files must exist…
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "border.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "light", "border.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "dark", "border.json")),
    ).toBe(true);

    // …and every previously-seeded file must be byte-for-byte
    // (mtime-for-mtime) untouched.
    const afterMtimes = collectMtimes(stableFiles);
    for (const file of stableFiles) {
      expect(afterMtimes[file]).toBe(seedMtimes[file]);
    }
  });

  it("rebuilds CSS from the on-disk tree — union of existing + new categories lands in build/*.css (AC #2)", async () => {
    const config = baseConfig();
    await seedInitState(tempDir, config);

    vi.mocked(p.text)
      .mockResolvedValueOnce("1,2,4,8")
      .mockResolvedValueOnce("2,4,8,16");
    vi.mocked(p.confirm).mockResolvedValueOnce(false);

    const outcome = await runAdd("border", config, tempDir);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;

    // Two themes → multi-theme CSS layout: primitives.css + light.css +
    // dark.css. Each must carry both the seeded core variables AND the
    // newly-added border variables, proving the build sources from disk.
    const primitivesCss = readFileSync(
      join(tempDir, "build", "primitives.css"),
      "utf-8",
    );
    expect(primitivesCss).toMatch(/--quieto-color-blue-500/);
    expect(primitivesCss).toMatch(/--quieto-spacing-/);
    expect(primitivesCss).toMatch(/--quieto-border-width-/);
    expect(primitivesCss).toMatch(/--quieto-border-radius-/);

    const lightCss = readFileSync(
      join(tempDir, "build", "light.css"),
      "utf-8",
    );
    expect(lightCss).toMatch(/--quieto-semantic-color-/);
    expect(lightCss).toMatch(/--quieto-semantic-border-/);
  });

  it("drives a full add-shadow happy path and persists categoryConfigs round-trip (Task 4)", async () => {
    const config = baseConfig();
    await seedInitState(tempDir, config);

    // Shadow prompts: levels (text), profile (select), color ref (select).
    // Pick 3 levels / hard / first available color ref.
    vi.mocked(p.text).mockResolvedValueOnce("3");
    vi.mocked(p.select)
      .mockResolvedValueOnce("hard")
      .mockResolvedValueOnce("{color.neutral.900}");

    const outcome = await runAdd("shadow", config, tempDir);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;

    // Full on-disk tree: primitive shadow file present, semantic shadow
    // files present under every theme, returned `categoryConfigs.shadow`
    // reflects the answers we fed into the prompts.
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "shadow.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "light", "shadow.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "dark", "shadow.json")),
    ).toBe(true);

    expect(outcome.result.categoryConfigs.shadow).toEqual({
      levels: 3,
      profile: "hard",
      colorRef: "{color.neutral.900}",
    });
    expect(outcome.result.categories).toContain("shadow");

    // The primitive JSON shape must reflect the chosen levels —
    // `generateShadowPrimitives` emits one entry per level under
    // `shadow.elevation.<n>`.
    const primitiveShadow = JSON.parse(
      readFileSync(
        join(tempDir, "tokens", "primitive", "shadow.json"),
        "utf-8",
      ),
    );
    expect(primitiveShadow.shadow?.elevation).toBeTruthy();
    expect(Object.keys(primitiveShadow.shadow.elevation)).toHaveLength(3);

    // Composite `$value` must be emitted as a real JSON object (not a
    // stringified blob) so Style Dictionary can resolve the embedded
    // `{color.neutral.900}` reference during the CSS build — this is
    // the regression guard for the fix that landed alongside this
    // story's shadow E2E.
    const level1 = primitiveShadow.shadow.elevation["1"];
    expect(level1.$type).toBe("shadow");
    expect(typeof level1.$value).toBe("object");
    expect(level1.$value.color).toBe("{color.neutral.900}");
  });

  /**
   * Manual-category-removal integration test — Story 2.4 Task 8.1 /
   * AC #11 / Story 2.2 Testing Strategy #4.
   *
   * Simulates the flow:
   *   1. `add border` → border files land on disk + `config.categories`
   *      lists `border`.
   *   2. User hand-edits `config.categories` on disk to remove `border`.
   *   3. `add animation` → the pruner sees `border.json` is orphaned
   *      (not in the active `categories` list) and deletes every
   *      `tokens/primitive/border.json` + `tokens/semantic/<theme>/border.json`.
   *
   * Re-pointed from `add shadow` to `add animation` in Story 2.5 after
   * the animation.ease primitive/semantic path collision was fixed.
   */
  it("prunes manually-removed categories on the next add run (AC #11)", async () => {
    const initialConfig = baseConfig();
    await seedInitState(tempDir, initialConfig);

    // Step 1: add border.
    vi.mocked(p.text)
      .mockResolvedValueOnce("1,2,4,8")
      .mockResolvedValueOnce("2,4,8,16");
    vi.mocked(p.confirm).mockResolvedValueOnce(false);

    const borderOutcome = await runAdd("border", initialConfig, tempDir);
    expect(borderOutcome.status).toBe("ok");
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "border.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "light", "border.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "dark", "border.json")),
    ).toBe(true);

    // Step 2: simulate the user hand-editing `config.categories` to
    // drop `border`. In the real CLI this happens in the user's text
    // editor; here we just construct the post-edit config directly.
    const postEditConfig = baseConfig({
      categories: ["color", "spacing", "typography"],
    });

    // Step 3: add animation. The pruner should notice `border.json`
    // is no longer referenced by `config.categories` and sweep it.
    vi.mocked(p.text).mockResolvedValueOnce("100,200,400");
    vi.mocked(p.select).mockResolvedValueOnce("standard");

    const animationOutcome = await runAdd("animation", postEditConfig, tempDir);
    expect(animationOutcome.status).toBe("ok");

    // Border files must be gone — across primitives and every theme.
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "border.json")),
    ).toBe(false);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "light", "border.json")),
    ).toBe(false);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "dark", "border.json")),
    ).toBe(false);

    // Animation files must be present (sanity — the add didn't regress
    // the new category write while pruning the old one).
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "animation.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "light", "animation.json")),
    ).toBe(true);

    // Core files must also survive the pruning pass — the pruner is
    // scoped to non-canonical categories only.
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "color.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "primitive", "spacing.json")),
    ).toBe(true);
  });

  /**
   * Full add-animation E2E — Story 2.5 AC #1, #4.
   *
   * Drives `runAdd("animation", …)` against a fresh tmp dir and asserts:
   *   - `status === "ok"` (no Style Dictionary reference errors)
   *   - CSS contains resolved cubic-bezier values for semantic ease
   *     custom properties (no self-references or unresolved strings)
   *   - On-disk semantic file has no self-referencing `$value` entries
   */
  it("add animation resolves cleanly — no self-references or SD errors (AC #1, #4)", async () => {
    const config = baseConfig();
    await seedInitState(tempDir, config);

    vi.mocked(p.text).mockResolvedValueOnce("100,200,400");
    vi.mocked(p.select).mockResolvedValueOnce("standard");

    const outcome = await runAdd("animation", config, tempDir);
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;

    expect(
      existsSync(join(tempDir, "tokens", "primitive", "animation.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "light", "animation.json")),
    ).toBe(true);
    expect(
      existsSync(join(tempDir, "tokens", "semantic", "dark", "animation.json")),
    ).toBe(true);

    // CSS must contain resolved cubic-bezier values, not unresolved refs.
    const lightCss = readFileSync(
      join(tempDir, "build", "light.css"),
      "utf-8",
    );
    expect(lightCss).toMatch(/--quieto-semantic-animation-ease-default/);
    expect(lightCss).not.toMatch(/\{animation\.ease\./);
    expect(lightCss).not.toMatch(/\{animation\.easing\./);

    const primCss = readFileSync(
      join(tempDir, "build", "primitives.css"),
      "utf-8",
    );
    expect(primCss).toMatch(/--quieto-animation-easing-default/);
    expect(primCss).toMatch(/--quieto-animation-duration-/);

    // On-disk semantic file must not self-reference.
    const semanticJson = JSON.parse(
      readFileSync(
        join(tempDir, "tokens", "semantic", "light", "animation.json"),
        "utf-8",
      ),
    );
    const easeNode = semanticJson.animation?.ease;
    if (easeNode) {
      for (const [role, entry] of Object.entries(easeNode) as [string, any][]) {
        const ref = entry.$value as string;
        expect(ref).not.toBe(`{animation.ease.${role}}`);
        expect(ref).toMatch(/^\{animation\.easing\./);
      }
    }
  });
});
