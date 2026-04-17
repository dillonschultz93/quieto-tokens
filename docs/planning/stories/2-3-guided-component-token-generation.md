# Story 2.3: Guided Component Token Generation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **solo developer building a component library**,
I want to run `quieto-tokens component <name>` to generate tier-3 component tokens that reference my existing semantic tokens,
so that I get a complete three-tier token system with component-specific decisions (variants, states) without hand-authoring JSON.

## Story Scope Note

This story introduces the **third tier** of the three-tier token system. Component tokens reference semantic tokens (with primitive-ref fallback) and are organised per-component, per-variant, per-property, per-state. The story carries four bundled concerns:

1. **`component` subcommand** — new CLI command with variant + state walkthrough.
2. **Tier-3 token type + DTCG emission** — `ComponentToken` interface, `PrimitiveToken | SemanticToken | ComponentToken` union usage where relevant, `tokens/component/<name>.json` output.
3. **Style Dictionary integration** — include `tokens/component/**/*.json` in every source glob; `--quieto-component-<name>-<variant>-<property>-<state>` naming via an extended `name/quieto` transform.
4. **Config persistence + pruner** — `components: Record<string, ComponentTokenConfig>` block; pruner deletes removed components' files.

Tasks below are dependency-ordered. Tasks 1–3 are prerequisites; Tasks 4–6 build the prompt walkthrough + generator; Tasks 7–9 are integration + tests + polish.

**Critical scoping constraint:** `component` does NOT modify primitive or semantic files. It writes ONLY to `tokens/component/<name>.json` and triggers a CSS rebuild. It does NOT accept a variant named `default` with no other variants (that's ambiguous — require at least one explicit variant OR declare `default` as the one-and-only variant via an explicit prompt).

## Acceptance Criteria

### Command surface

1. **Given** a `quieto.config.json` with at least primitive + semantic tokens exists, **When** the user runs `quieto-tokens component button` (or any valid component name), **Then** the CLI loads the existing token system, presents available semantic tokens as options for each component property, walks through the variant + state matrix, generates `tokens/component/button.json`, rebuilds CSS to include the new component tokens, and updates `quieto.config.json`'s `components` block.
2. **Given** the user runs `quieto-tokens component` with no name, **When** the command starts, **Then** the CLI exits non-zero with `p.log.error "A component name is required"` + `p.note(HELP_TEXT)` + `p.outro`.
3. **Given** the user runs `quieto-tokens component <name>` where `<name>` fails validation (see Dev Notes → Component Name Rules), **When** the command starts, **Then** the CLI exits non-zero with the validator's error message.
4. **Given** no `quieto.config.json` exists, **When** the user runs `quieto-tokens component <anything>`, **Then** the CLI exits non-zero telling the user to run `quieto-tokens init` first. Do NOT silently fall through to `init`.
5. **Given** the config exists but is `corrupt` / `invalid`, **When** `component` runs, **Then** the CLI surfaces the same Abort-only recovery UX as `add` (Story 2.2 AC 5). No "Start fresh" — component generation cannot synthesize a baseline.
6. **Given** `tokens/component/<name>.json` already exists (re-authoring), **When** `component <name>` runs, **Then** the CLI confirms via `p.confirm` with a warning that existing tokens for this component will be replaced. On decline → exit 0 cleanly.

### Variant + state walkthrough

7. **Given** the walkthrough starts, **When** the variant prompt runs, **Then** the user is asked (`p.text` with multi-line support OR `p.multiselect` fallback) for one or more variant names (e.g., `primary, secondary, tertiary`). At least one variant is required; variant names are validated (same rules as component names — lowercase kebab-case). An explicit "default only" option is offered via a `p.confirm "Use a single default variant?"` at the top of the step.
8. **Given** variants are chosen, **When** the property prompt runs, **Then** for each variant the CLI walks the **standard component properties**: `color-background`, `color-content`, `color-border`, `spacing-padding`, `border-radius`, `typography`. Each property is individually skippable via a `p.confirm "Include <property>?"`.
9. **Given** a property is included for a variant, **When** the state prompt runs, **Then** the user is asked (`p.multiselect`) which states apply: `default` (always on), `hover`, `active`, `focus`, `disabled`. `default` cannot be deselected; `disabled` is opt-in not default-on.
10. **Given** the state matrix is chosen, **When** the value-assignment prompt runs, **Then** for each (variant × property × state) combination, the CLI shows a `p.select` of available semantic tokens filtered by property (e.g., `color-background` shows only `color.background.*` semantics; `typography` shows composite typography-role names). A "Custom reference" option accepts a raw DTCG ref string (validated via a regex: `^\{[a-z][a-z0-9.-]*\}$`).
11. **Given** `spacing-padding` is selected, **When** the value prompt runs, **Then** the user can choose EITHER a single spacing semantic OR enter four values (top, right, bottom, left) each mapped to a spacing semantic — emitted as four tokens `spacing-padding-top`, `spacing-padding-right`, `spacing-padding-bottom`, `spacing-padding-left`. The "single value" short-form emits one token `spacing-padding`.
12. **Given** `typography` is selected, **When** the value prompt runs, **Then** the user picks a single semantic typography role (e.g., `typography.body`, `typography.label`) which auto-expands into `typography-font-size` and `typography-font-weight` component tokens referencing the role's composite semantics.

### Output shape

13. **Given** the walkthrough completes, **When** token generation runs, **Then** each emitted component token follows the three-tier naming convention: `<component>.<variant>.<property>.<state>`. For the `default` state, the state segment is OMITTED (e.g., `button.primary.color.background` for default; `button.primary.color.background.hover` for hover). For variant-less components (single default variant), the variant segment is `default` (e.g., `button.default.color.background`).
14. **Given** component tokens are generated, **When** the DTCG tree is serialised, **Then** `tokens/component/<name>.json` is written with the `$metadata` banner at the root (Story 2.1 AC 16) and a nested tree keyed by `<variant>.<property>.<state>`. Each leaf has `$type` matching the referenced semantic's type (`color`, `dimension`, `fontWeight`, etc.) and `$value` containing the DTCG reference (e.g., `{color.background.primary}`).
15. **Given** the user chose a custom reference for any value, **When** the tree is serialised, **Then** the custom reference string is written verbatim into `$value` and Style Dictionary's `brokenReferences: "throw"` guard (existing) will fail the build if the reference doesn't resolve. The pre-write resolver in the CLI performs a lookahead check and aborts with `p.log.error "Reference {custom.ref} does not exist in the current token system"` BEFORE writing, so the user sees the error at prompt time, not at build time.

### Style Dictionary integration

16. **Given** component JSON files exist, **When** Style Dictionary rebuilds, **Then** every CSS output file includes the component tokens. CSS variable names follow the pattern `--quieto-component-<name>-<variant>-<property>-<state>` (tier-identifier segment `component` is injected between the prefix and the path, mirroring how `semantic` is injected for semantic tokens in Story 1.8).
17. **Given** the name transform runs on a component token with state `default`, **When** the CSS is emitted, **Then** the `default` segment is OMITTED (mirroring AC #13) — e.g., `--quieto-component-button-primary-color-background` for default, `--quieto-component-button-primary-color-background-hover` for hover.
18. **Given** the multi-theme flow is active (light + dark), **When** CSS is rebuilt, **Then** component tokens appear in **both** theme CSS files (because component tokens reference semantic tokens, which differ per theme). Verify via an integration test that `build/dark.css` contains `--quieto-component-button-primary-color-background` and that its `var(--quieto-semantic-...)` reference resolves to the dark-theme semantic variable.

### Persistence

19. **Given** the token file is written and CSS is rebuilt, **When** the config write runs, **Then** `quieto.config.json` gains a top-level `components: Record<string, ComponentTokenConfig>` block (missing on quick-start / 2.1 / 2.2 configs — optional legacy), keyed by component name. The value captures the user's inputs so re-runs are deterministic (variants, properties, states, value assignments per cell). `version` is bumped; `generated` is refreshed; `categories` is NOT touched (component is not a "category" in the `categories[]` sense — it's a separate tier).
20. **Given** a legacy config (Epic 1 / 2.1 / 2.2) without `components`, **When** `loadConfig` returns `ok`, **Then** `config.components` is `undefined` (NOT `{}`). The on-disk file is not mutated on read. First-write-after-upgrade adds `components: { <name>: ... }`.
21. **Given** `validateConfigShape` runs, **When** `components` is present, **Then** every component entry is structurally validated; errors emit paths like `components.button.variants[0].properties.color-background.states.hover.value`.

### Pruner

22. **Given** a component entry is removed from `config.components` (manual edit), **When** the next `component <other>` (or `add` or `init`) run completes, **Then** the pruner (extended from Story 2.2) deletes `tokens/component/<removed-name>.json`. Log via `p.log.info "✗ Removed tokens/component/<name>.json"`.
23. **Given** the pruner is walking `tokens/component/`, **When** no entries exist in `config.components`, **Then** all files in `tokens/component/*.json` are removed. The directory itself may be left in place; SD tolerates empty globs.

### Outro

24. **Given** the flow completes successfully, **When** the outro runs, **Then** the CLI prints:
    - A success summary with the file path written and the total component-token count (e.g., "Wrote 24 component tokens to tokens/component/button.json").
    - A "What's next" tip: `Import build/light.css (and build/dark.css) into your project — your component tokens are available as --quieto-component-<name>-* custom properties.`
    - The canonical outro `p.outro("Component saved — you can re-run to modify this component anytime.")`.

## Tasks / Subtasks

- [ ] **Task 1: CLI `component` subcommand wiring (AC #1, #2, #3, #4, #5)**
  - [ ] 1.1: In `src/cli.ts`, add a `component` branch alongside `init` / `add`.
  - [ ] 1.2: Add `parseComponentArgs(args: readonly string[]): { name?: string; unknown: string[] }` mirroring `parseInitArgs`. The first positional is the component name; no flags in this story scope.
  - [ ] 1.3: If the component name is missing → `p.intro` + `p.log.error("A component name is required")` + `p.note(HELP_TEXT)` + `p.outro` + `process.exit(1)`.
  - [ ] 1.4: Validate the name via `validateComponentName` (Task 3.1). On failure → same Clack error path as above.
  - [ ] 1.5: Extend `HELP_TEXT` in `src/cli.ts` with the new command + argument.

- [ ] **Task 2: `componentCommand` orchestration (AC #1, #4, #5, #6)**
  - [ ] 2.1: Create `src/commands/component.ts` exporting `export async function componentCommand(options: ComponentCommandOptions): Promise<void>` where `ComponentCommandOptions = { name: string }`.
  - [ ] 2.2: Check `configExists(process.cwd())`. On false → `p.log.error` + `p.outro("Run `quieto-tokens init` first to create a token system.")` + exit 1.
  - [ ] 2.3: `loadConfig` with the injectable Clack logger. Branch:
    - `missing` → TOCTOU bail (Story 2.1 / 2.2 pattern).
    - `corrupt` / `invalid` → Abort-only `p.select` with "Abort" and "Show details" (no Start fresh).
    - `ok` → proceed.
  - [ ] 2.4: If `tokens/component/<name>.json` exists on disk → `p.confirm "Re-author <name>? Existing tokens will be replaced."` On decline → `p.outro("Nothing changed.")` + return.
  - [ ] 2.5: Regenerate the full `ThemeCollection` from `config.inputs` + `config.advanced` + `config.categoryConfigs` (mirror `runAdd` Task 7.2 from Story 2.2 — extract the shared code into `src/pipeline/rebuild.ts` as part of this story if Story 2.2 didn't already; if 2.2 did, reuse directly).
  - [ ] 2.6: Dispatch to `collectComponentInputs(config, name, priorComponentConfig)` (Task 4).
  - [ ] 2.7: Generate component tokens via `generateComponentTokens(config, name, inputs)` (Task 5).
  - [ ] 2.8: Write `tokens/component/<name>.json` via a new `writeComponentTokens(tree, outputDir, generatedAt)` helper added to `src/output/json-writer.ts` (Task 3.3).
  - [ ] 2.9: Rebuild CSS via `buildCss(collection, cwd)` — but `collection` must now carry the component tokens. See Task 3.4 for the writer / SD integration.
  - [ ] 2.10: Run the pruner with the updated `config.components` list (Task 6).
  - [ ] 2.11: Update the config's `components[name] = userInputs`; re-read `version`; refresh `generated`; call atomic `writeConfig`.
  - [ ] 2.12: Outro (Task 9.1).

- [ ] **Task 3: Tier-3 token type + name validation + writer refactor (AC #13, #14, #16, #17)**
  - [ ] 3.1: In `src/types/tokens.ts`, add:
    ```typescript
    export interface ComponentToken {
      tier: "component";
      category: string; // "component"
      componentName: string; // e.g., "button"
      name: string; // full dotted path
      $type: string;
      $value: string;
      description?: string;
      path: string[]; // ["<name>", "<variant>", "<property>", "<state>?"]
    }

    export interface ThemeCollection {
      primitives: PrimitiveToken[];
      themes: Theme[];
      /**
       * Component tokens are tier-3 and theme-agnostic at the token level
       * — they reference semantic tokens, which differ per theme. Keeping
       * them at the collection root (not per-theme) avoids duplication.
       */
      components?: ComponentToken[];
    }
    ```
    Leave `ComponentToken` theme-agnostic; theming is delegated to the semantic refs it points at.
  - [ ] 3.2: Add `export function validateComponentName(name: string): string | undefined` in `src/utils/validation.ts`:
    - Non-empty after trim.
    - Lowercase kebab-case: `/^[a-z][a-z0-9-]*$/`.
    - ≤ 40 characters.
    - Not one of the reserved names: `color`, `spacing`, `typography`, `shadow`, `border`, `animation`, `primitive`, `semantic`, `component`, `default`.
  - [ ] 3.3: In `src/output/json-writer.ts`, add `export async function writeComponentTokens(tokens: ComponentToken[], outputDir: string, options: WriteTokensOptions): Promise<string[]>`. Group by `componentName` (even though a single `component` run writes one component, keep the helper reusable). Output path: `<outputDir>/tokens/component/<componentName>.json`. Tree building: use the existing `tokensToDtcgTree` helper with a slight tweak — the root path segment is the component name itself (NOT `component` — the `component` tier identifier is injected by the CSS name transform, not the JSON file layout).
  - [ ] 3.4: In `src/output/style-dictionary.ts`:
    - Extend every source glob to include `tokens/component/**/*.json`.
    - Extend the `isComponentToken` detection (new helper mirroring `isSemanticToken`: `filePath.includes("/tokens/component/")`).
    - Extend `QUIETO_NAME_TRANSFORM` to inject a `component` segment instead of `semantic` when the token comes from a component file. Mutually exclusive with the semantic branch. The `default` state segment must be stripped from the emitted name (AC #17) — detect by checking `token.path[token.path.length - 1] === "default"` and omitting it.
    - The CSS `filter` on theme builds must include component tokens alongside semantic tokens so they end up in every theme file.
  - [ ] 3.5: Extend `writeTokensToJson` signature to also accept `ComponentToken[]` via the collection's `components` field. Pattern: call `writeComponentTokens` at the end of `writeTokensToJson` if `collection.components?.length`. Preserves the single-call ergonomics in `runOutputGeneration`.

- [ ] **Task 4: Component walkthrough collector (AC #7, #8, #9, #10, #11, #12, #15)**
  - [ ] 4.1: Create `src/commands/component-flow.ts` exporting `collectComponentInputs(config, name, prior)`:
    ```typescript
    export async function collectComponentInputs(
      config: QuietoConfig,
      name: string,
      prior: ComponentTokenConfig | undefined,
    ): Promise<ComponentTokenConfig>;
    ```
    Return the full authored config (variants × properties × states × values).
  - [ ] 4.2: Step 1 — Variants (AC #7). `p.confirm "Use a single 'default' variant?"` first. If YES → variants = `["default"]`. If NO → `p.text` collecting comma-separated variant names (validated: same rules as component name validator, ≥ 1 variant). Prior variants pre-fill.
  - [ ] 4.3: Step 2 — For each variant, walk properties (AC #8). For each of the six standard properties (`color-background`, `color-content`, `color-border`, `spacing-padding`, `border-radius`, `typography`) ask `p.confirm "Include <property> for variant <v>?"`. Skipping a property means no tokens emitted for that property on that variant.
  - [ ] 4.4: Step 3 — For each included (variant × property), walk states (AC #9). `p.multiselect` with options `default` (pre-checked, required), `hover`, `active`, `focus`, `disabled`. User cannot deselect `default`.
  - [ ] 4.5: Step 4 — For each (variant × property × state), present a semantic-token `p.select` filtered by property (AC #10):
    - `color-background` → semantics starting with `color.background.*`
    - `color-content` → semantics starting with `color.content.*`
    - `color-border` → semantics starting with `color.border.*`
    - `spacing-padding` → semantics starting with `spacing.*` (plus the 4-sides branch — AC #11)
    - `border-radius` → semantics starting with `border.radius.*` (requires Story 2.2 `border` category; if not present, `p.log.warn "Border category not configured; add it first with 'quieto-tokens add border'"` and skip the property)
    - `typography` → semantic typography roles (`typography.headline`, `typography.body`, etc.) — auto-expands into font-size + font-weight component tokens (AC #12)
    Each `p.select` includes a final "Custom reference" option that unlocks a `p.text` prompt validated against the custom-ref regex (AC #15) AND pre-validated against the current token system's reference registry (the `tokens[]` array derived in Task 2.5) — if the ref doesn't resolve, show the validator error on the prompt.
  - [ ] 4.6: Step 5 — Special-case `spacing-padding` shorthand vs per-side (AC #11). After the property is included, ask `p.select "Padding: single value or four-sides?"` — branch accordingly.
  - [ ] 4.7: Step 6 — Special-case `typography` role expansion (AC #12). The user picks ONE typography semantic role; the generator (Task 5) emits two component tokens per state.
  - [ ] 4.8: Abort handling: every prompt wrapped in the existing `handleCancel` helper (extract to `src/utils/prompts.ts` if not already shared). Cancel throws `Error("cancelled")` which the command-level catch swallows, matching the existing pattern.
  - [ ] 4.9: The returned `ComponentTokenConfig` deeply captures the user's inputs so re-runs are deterministic:
    ```typescript
    export interface ComponentTokenConfig {
      variants: string[];
      cells: Array<{
        variant: string;
        property: ComponentProperty;
        paddingShape?: "single" | "four-sides"; // only for spacing-padding
        states: Array<{
          state: "default" | "hover" | "active" | "focus" | "disabled";
          value: string | { top: string; right: string; bottom: string; left: string }; // DTCG refs
        }>;
      }>;
    }
    ```

- [ ] **Task 5: Component token generator (AC #13, #14, #15)**
  - [ ] 5.1: Create `src/generators/component.ts` exporting `generateComponentTokens(config: QuietoConfig, componentName: string, input: ComponentTokenConfig, semanticTokens: SemanticToken[]): ComponentToken[]`.
  - [ ] 5.2: For each cell × state, emit a `ComponentToken`:
    - Path: `[componentName, variant, ...propertySegments, ...(state === "default" ? [] : [state])]`. See property-segment mapping below.
    - Name: `path.join(".")`.
    - `$type`: infer from the referenced semantic's `$type` — look up in `semanticTokens`. For custom refs, parse the ref and look it up in `semanticTokens | primitives`. If the ref does not resolve, throw `Error("Unresolved reference: <ref>")` BEFORE any file is written (AC #15).
    - `$value`: the DTCG reference string (e.g., `{color.background.primary}`).
  - [ ] 5.3: Property-segment mapping:
    | Property | Path segments |
    |---|---|
    | `color-background` | `["color", "background"]` |
    | `color-content` | `["color", "content"]` |
    | `color-border` | `["color", "border"]` |
    | `spacing-padding` (single) | `["spacing", "padding"]` |
    | `spacing-padding` (four-sides) | `["spacing", "padding", "top"]`, `…-right`, `…-bottom`, `…-left` (emit 4 tokens per state) |
    | `border-radius` | `["border", "radius"]` |
    | `typography` | expand to two tokens: `["typography", "font-size"]` + `["typography", "font-weight"]`, each referencing the role's composite semantics |
  - [ ] 5.4: The "component tokens reference semantic tokens" rule (AC from epic) is enforced structurally: the generator only accepts DTCG refs, never raw values. If a user supplies a raw hex or pixel value at the custom-ref prompt, the validator (Task 4.5) rejects it before it reaches the generator.

- [ ] **Task 6: Pruner extension for components (AC #22, #23)**
  - [ ] 6.1: Extend `src/output/pruner.ts` (created in Story 2.2) to also scan `tokens/component/*.json`. Add a `knownComponents: readonly string[]` param.
  - [ ] 6.2: Any component file whose basename (sans `.json`) is NOT in `knownComponents` is `unlink`ed. Best-effort on failure (same pattern as the category pruner).
  - [ ] 6.3: Update `runConfigGeneration` (and `runAdd`) to pass `knownComponents = Object.keys(config.components ?? {})` through to `prune`.
  - [ ] 6.4: **Safety:** a FIRST component-authoring run on a project that never had components must NOT delete anything. The pruner's `readdir` on a missing directory (`tokens/component/`) returns ENOENT — catch and treat as empty. Do NOT mkdir the directory from the pruner; the writer (Task 3.3) creates it as a side effect of `writeFile`.

- [ ] **Task 7: Schema v4 — `components` block + validator (AC #19, #20, #21)**
  - [ ] 7.1: In `src/types/config.ts`, add:
    ```typescript
    export interface QuietoConfig {
      // ...existing...
      components?: Record<string, ComponentTokenConfig>;
    }

    export type ComponentProperty =
      | "color-background"
      | "color-content"
      | "color-border"
      | "spacing-padding"
      | "border-radius"
      | "typography";

    export type ComponentState =
      | "default" | "hover" | "active" | "focus" | "disabled";

    export interface ComponentTokenConfig {
      variants: string[];
      cells: ComponentCell[];
    }

    export interface ComponentCell {
      variant: string;
      property: ComponentProperty;
      paddingShape?: "single" | "four-sides";
      states: ComponentCellState[];
    }

    export interface ComponentCellState {
      state: ComponentState;
      /**
       * DTCG reference string for single-value cells (e.g.
       * `{color.background.primary}`). For `spacing-padding` cells with
       * `paddingShape: "four-sides"`, a record keyed by side name.
       */
      value: string | { top: string; right: string; bottom: string; left: string };
    }
    ```
  - [ ] 7.2: Extend `validateConfigShape` (`src/utils/config.ts`) to walk `components` if present:
    - Each component-name key must match the component-name validator.
    - `variants: string[]` required, length ≥ 1, each entry passes `validateComponentName`.
    - `cells: ComponentCell[]` required.
    - Each `cell.variant` must appear in `variants`.
    - Each `cell.property` must be one of the `ComponentProperty` literals.
    - Each `cell.states` array must have at least one entry, must include a `default` state exactly once, must not duplicate states.
    - `paddingShape` only permitted when `property === "spacing-padding"`.
    - Each state's `value` is either a DTCG-ref string OR, for 4-sides padding, a record of 4 DTCG-ref strings.
    - Error paths: `components.<name>.variants[<i>]`, `components.<name>.cells[<i>].<field>`, `components.<name>.cells[<i>].states[<j>].<field>`.
  - [ ] 7.3: Extend `loadConfig`'s explicit field copy + deep-clone to cover `components` (JSON round-trip, same prototype-pollution guard used for `advanced` + `categoryConfigs`).
  - [ ] 7.4: Extend `BuildConfigInput` + `buildConfig` in `src/output/config-writer.ts` to accept + passthrough `components`.
  - [ ] 7.5: Extend `ConfigGenerationInput` in `src/pipeline/config.ts` to accept + passthrough `components`.

- [ ] **Task 8: Pipeline integration (AC #1, #16, #18)**
  - [ ] 8.1: Create `src/pipeline/component.ts` exporting `runComponent(config, name, cwd): Promise<ComponentPipelineResult | null>`. Orchestrates Tasks 4–6 end-to-end. Returns the updated `components` map for the config-write step.
  - [ ] 8.2: Wire `runComponent` into `componentCommand` (Task 2).
  - [ ] 8.3: Re-use the shared `src/pipeline/rebuild.ts` helper introduced by (or introduced in) Story 2.2 to regenerate the full `ThemeCollection` from the config. If 2.2 did NOT land this helper, introduce it here: `export function rebuildCollectionFromConfig(config: QuietoConfig): ThemeCollection` — pure function, no Clack narration.
  - [ ] 8.4: After collection rebuild, append the new component tokens into `collection.components`, then call `runOutputGeneration(collection, cwd)`. The writer (Task 3.5) picks up `collection.components` and writes `tokens/component/<name>.json`; SD (Task 3.4) picks up the new glob and emits CSS.

- [ ] **Task 9: Outro + README + tests + sprint validate (AC #24)**
  - [ ] 9.1: In `componentCommand`, after `writeConfig` succeeds, emit `p.log.success` with file path + component-token count, then `p.log.info` with the "What's next" tip, then `p.outro("Component saved — you can re-run to modify this component anytime.")`.
  - [ ] 9.2: Update `src/pipeline/config.ts`'s main-pipeline "What's next" copy to add a line: `  • Run "quieto-tokens component button" (or any component name) to author component tokens`.
  - [ ] 9.3: Update README.md:
    - Move "Component — planned" in the Token Tiers table to "Component — shipped".
    - Add a "Component tokens" subsection under "Advanced mode" describing `quieto-tokens component <name>`, the variant/state walkthrough, and the output file layout.
    - Add a CSS usage example: `color: var(--quieto-component-button-primary-color-content)`.
  - [ ] 9.4: **Tests (see Dev Notes → Testing Strategy for coverage):**
    - `src/__tests__/cli.test.ts` — extend with `component` branches: missing name, invalid name, unknown flag, happy path routing.
    - `src/commands/__tests__/component.test.ts` — orchestrator tests: missing config path, corrupt/invalid Abort flow, re-author confirm flow.
    - `src/commands/__tests__/component-flow.test.ts` — prompt-collector unit tests, mocking `@clack/prompts`: single-default variant, multi-variant, skip property, multi-state, custom ref (resolved + unresolved), 4-sides padding, typography role expansion.
    - `src/generators/__tests__/component.test.ts` — generator unit tests: path shape, state omission on default, typography expansion emits 2 tokens, 4-sides padding emits 4 tokens, unresolved ref throws BEFORE any side effect.
    - `src/utils/__tests__/validation.test.ts` — extend with `validateComponentName` cases (happy path, reserved names, case, kebab).
    - `src/output/__tests__/json-writer.test.ts` — extend with `writeComponentTokens` coverage including `$metadata` banner.
    - `src/output/__tests__/style-dictionary.test.ts` — extend with a single-theme + multi-theme assertion that component tokens land in every theme's CSS with the correct `--quieto-component-*` naming, including state omission on default.
    - `src/output/__tests__/pruner.test.ts` — extend (from 2.2) for component deletion: orphaned `tokens/component/<old>.json` is removed when `config.components` drops the entry; missing `tokens/component/` dir is tolerated.
    - `src/pipeline/__tests__/component.test.ts` — end-to-end smoke: mock prompts, tmp dir, assert `tokens/component/button.json` on disk, CSS regenerated, config persisted.
    - `src/utils/__tests__/config.test.ts` — extend `validateConfigShape` for every `components` error path.
  - [ ] 9.5: `npm run type-check` — clean.
  - [ ] 9.6: `npm test -- --run` — all tests pass. Expect test count to grow ~40+ from this story's additions.
  - [ ] 9.7: `npm run build` — ESM + DTS emit succeed.
  - [ ] 9.8: `npm run validate:sprint` — passes.

## Dev Notes

### Relevant ADRs

- **[ADR-001](../architecture/adr-001-non-destructive-json-merge.md)** — Per-file ownership + `quieto.config.json` as canonical manifest. This story treats `config.components` as the manifest for the component tier exactly the way `config.categories` is the manifest for categories. Stale-component pruning (Task 6) is the ADR's Option-B "diff the manifest, unlink what's missing" pattern applied to the component tier.
- **[ADR-002](../architecture/adr-002-story-status-single-source-of-truth.md)** — `npm run validate:sprint` must pass after every status transition.

### Previous Story Intelligence (Stories 2.1 + 2.2)

Stories 2.1 and 2.2 shipped the substrate this story builds on. Do not re-implement them; reuse.

From **Story 2.1**:

- `loadConfig` returns `LoadConfigResult` — reuse the discriminated union; use the injectable Clack logger.
- `$metadata` banner lands on every file written by `writeJsonFile`/`writeTokensToJson` automatically (Task 3 of 2.1). Your new `writeComponentTokens` helper MUST use the same `writeJsonFile` private helper so the banner is inherited for free.
- Atomic config writes, BOM strip, ESM-only, Clack-only output, `DEFAULT_CATEGORIES` frozen — all still apply.
- **Prototype-pollution guard:** every new parsed field in `loadConfig` must be deep-cloned via JSON round-trip (explicit field copy on the root). Do NOT spread parsed JSON.

From **Story 2.2**:

- `src/output/pruner.ts` exists and is wired into the write pipeline. Extend it; do NOT create a second pruner.
- `src/utils/categories.ts` exists with `sortCategoriesCanonical`. Component names are ordered alphabetically within the `components` map; no canonical-order analogue needed.
- `src/pipeline/rebuild.ts` (OR `runAdd`'s Task 7.2 inline equivalent) — use it to regenerate the primitive + semantic + new-category tokens needed to resolve refs. If 2.2 landed this as inline code instead of a helper, extract it as part of this story (Task 8.3).
- `src/utils/overrides.ts::applyPriorOverrides` exists and should be called before component-token generation so custom refs resolve against the user's overridden semantic values, not the mapper defaults.

**Review findings from 2.1 that remain relevant:**
- `compareVersions` semver fidelity still deferred — do not expand scope.
- Shared `package.json` version resolver still deferred — one more duplication is acceptable but flag it.
- Concurrent-writer race still deferred — do not add lockfile logic.

### Component Name Rules

Handled by `validateComponentName` (Task 3.2):

- Non-empty after trim.
- Matches `/^[a-z][a-z0-9-]*$/` (lowercase letters + digits + hyphens; must start with a letter).
- ≤ 40 characters.
- NOT one of the reserved names: `color`, `spacing`, `typography`, `shadow`, `border`, `animation`, `primitive`, `semantic`, `component`, `default`.

Rejected examples: `Button` (capital), `button_primary` (underscore), `button primary` (space), `2button` (leading digit), `component` (reserved), `---` (no leading letter).

Accepted examples: `button`, `text-field`, `dropdown-menu`, `modal`, `toast`.

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | `@clack/prompts` | ^1.2.0 |
| Test runner | Vitest | ^4.x |
| Output transforms | Style Dictionary | ^5.4.0 |
| Color engine | `@quieto/engine` | ^0.1.1 (only needed if the rebuild helper is re-running color generation — which it is) |

**Style Dictionary integration critical path:** component tokens MUST appear in every theme's CSS, not just in a theme-agnostic bundle. Story 1.8 / 2.1 ship `runSingleTheme`, `runPrimitivesOnly`, and `runThemeSemantics` in `src/output/style-dictionary.ts`. The `isSemanticToken` filter in `runThemeSemantics` is currently `filePath.includes("/tokens/semantic/")` — extend it to `isSemanticOrComponentToken` that ALSO matches `/tokens/component/`, so components are included in per-theme CSS files. The `QUIETO_NAME_TRANSFORM` must then route each token type to its own tier segment (`semantic` vs `component`). Validate with a multi-theme test.

### Architecture Constraints

- **Component tokens never own values directly.** They are pure references into the semantic tier (or, in edge cases, directly into primitives via a custom ref). The generator structurally enforces this (Task 5.4) — a user can't sneak a raw hex into a component token.
- **Tokens are theme-agnostic at the JSON-file level.** `tokens/component/<name>.json` is a single file per component, NOT split across themes. Theming is delegated to the CSS cascade: the component token references `{color.background.primary}`, which expands differently in `light.css` vs `dark.css`.
- **File-per-component layout** matches the existing category-per-file pattern. One file per component, owned exclusively by quieto. Stale cleanup via `config.components` is the manifest (Task 6).
- **State "default" is semantically transparent.** Output paths and CSS variables omit the `default` segment (AC #13, #17). This keeps the base component token name stable: `button.primary.color.background` is the hoverless, focusless base; `button.primary.color.background.hover` is the hover override. CSS consumers can then write `.btn-primary { background: var(--quieto-component-button-primary-color-background); }` and `.btn-primary:hover { background: var(--quieto-component-button-primary-color-background-hover); }` naturally.
- **`components` is OPTIONAL on disk.** Quick-start, 2.1, and 2.2 configs have no `components` block. First-write-after-`component`-run adds it. `loadConfig` returns `config.components = undefined` on a legacy file.

### Component Tier + CSS Naming

| Tier | Example path | Example CSS var |
|---|---|---|
| Primitive | `color.blue.500` | `--quieto-color-blue-500` |
| Semantic | `color.background.primary` | `--quieto-semantic-color-background-primary` |
| Component (default state) | `button.primary.color.background` | `--quieto-component-button-primary-color-background` |
| Component (hover state) | `button.primary.color.background.hover` | `--quieto-component-button-primary-color-background-hover` |
| Component (4-sides padding) | `button.primary.spacing.padding.top` | `--quieto-component-button-primary-spacing-padding-top` |
| Component (typography expansion) | `button.primary.typography.font-size` | `--quieto-component-button-primary-typography-font-size` |

The `component` segment is injected by the CSS name transform (Task 3.4), mirroring how `semantic` is injected by the existing transform. The segment is NOT part of the JSON path — the JSON file is keyed by component name + variant + property + state directly.

### DTCG Reference Resolution (AC #15)

Before writing the JSON file, walk every emitted `$value`:

1. Extract the ref: `$value.match(/^\{([^}]+)\}$/)`. If no match, fail — component tokens must be refs.
2. Resolve the ref against `ThemeCollection.primitives` AND every `Theme.semanticTokens` for every theme. The ref resolves if ANY theme has the token at the given path.
3. If unresolved, `p.log.error` with the offending component path + ref, and `throw new Error("cancelled")` (catch in `componentCommand` → clean exit).

**Why pre-write validation matters:** Style Dictionary's `brokenReferences: "throw"` would catch the problem at build time, but only after writing the JSON. That leaves a broken `tokens/component/<name>.json` on disk — bad UX. Validate early.

### Testing Strategy

**Mirrored from Stories 2.1 + 2.2:** mock `@clack/prompts` at module scope, use `mkdtempSync` for filesystem assertions, pure generator tests have no Clack import.

Critical test cases that must pass:

1. **`component button` on a minimal 2.1 config** → writes `tokens/component/button.json`, rebuilds CSS (both single-theme and multi-theme cases), config gains `components.button`.
2. **Re-authoring flow** (`component button` twice) → second run shows confirm; on accept, replaces the file; on decline, no writes.
3. **Custom ref to a non-existent token** → the collector rejects the input at prompt time with the validator's error message; no file ever written.
4. **4-sides padding** → emits 4 tokens per state; CSS has 4 `--*-padding-top/-right/-bottom/-left` vars.
5. **Typography role expansion** → emits 2 tokens per (variant × state) per typography cell; CSS has `--*-typography-font-size` + `--*-typography-font-weight`.
6. **Default state segment omitted** in both JSON path + CSS name.
7. **Multi-theme components in CSS** → `build/light.css` AND `build/dark.css` both contain `--quieto-component-*` vars, AND their `var(...)` refs resolve to theme-specific semantic vars.
8. **Pruner removes an orphaned component file** when `config.components` loses an entry; a missing `tokens/component/` directory on first run is tolerated.
9. **Reserved component name** (`component button` attempted with `name = "component"`) is rejected at `parseComponentArgs` / `validateComponentName`.
10. **Prototype pollution in `components`** — `"components": { "__proto__": { ... } }` does NOT pollute `Object.prototype`.
11. **`validateConfigShape` negative tests** for every shape error: missing `variants`, empty `variants`, unknown property, state array without `default`, `paddingShape` on a non-padding cell, invalid DTCG ref string.
12. **Round-trip:** `buildConfig` → `writeConfig` → `loadConfig` preserves `components` exactly.

### What NOT to Build

- **Do NOT implement multi-component batch authoring** (e.g., `quieto-tokens component button dropdown modal`). One component per invocation — users can re-run.
- **Do NOT implement component variants with nested sub-variants.** The matrix is flat: variant × property × state. Nested variants (e.g., `button.primary.small.color.background.hover`) are out of scope.
- **Do NOT accept raw token values in component cells.** Only DTCG refs. If the user wants a raw value, they should first express it as a primitive / semantic token, then reference it.
- **Do NOT auto-generate component tokens from design input** (e.g., a `p.confirm "Generate button tokens from your semantic tokens automatically?"`). The walkthrough is explicit by design; auto-generation is a future epic.
- **Do NOT implement component import/export** (reading a "component spec" from a file). Authoring is interactive only; re-runs consume `config.components` for deterministic pre-fill.
- **Do NOT implement `--dry-run`.** That is Story 3.3.
- **Do NOT implement changelog generation.** That is Story 3.4.
- **Do NOT expose component authoring via `init` or `add`.** Three orthogonal commands: `init` (full pipeline), `add` (new category), `component` (new component). Keep the surface orthogonal.
- **Do NOT support variant inheritance** (e.g., "all hover states across all variants share the same value"). Each cell is authored individually.
- **Do NOT migrate `compareVersions`, extract the version resolver, or add lockfile protection.** All still deferred.

### File Structure (final target)

```
src/
├── cli.ts                            ← modified (component branch)
├── index.ts                          ← modified (new type + helper exports)
├── commands/
│   ├── component.ts                  ← NEW (orchestrator)
│   ├── component-flow.ts             ← NEW (prompt collector)
│   ├── add*.ts                       ← unchanged (from Story 2.2)
│   ├── advanced*.ts                  ← unchanged
│   ├── init.ts                       ← unchanged
│   └── quick-start.ts                ← unchanged
├── generators/
│   ├── component.ts                  ← NEW
│   └── color / spacing / typography / shadow / border / animation ← unchanged
├── mappers/
│   └── semantic.ts (or per-category) ← unchanged (component tier has no mapper)
├── output/
│   ├── json-writer.ts                ← modified (writeComponentTokens + category walk)
│   ├── style-dictionary.ts           ← modified (component source glob + name transform)
│   ├── pruner.ts                     ← modified (component branch)
│   └── config-writer.ts              ← modified (components passthrough)
├── pipeline/
│   ├── component.ts                  ← NEW
│   ├── rebuild.ts                    ← NEW (or reused from Story 2.2)
│   ├── add.ts                        ← unchanged (Story 2.2)
│   ├── config.ts                     ← modified (outro + components input)
│   ├── color / output / spacing-typography ← unchanged
├── types/
│   ├── config.ts                     ← modified (ComponentTokenConfig + companion types)
│   └── tokens.ts                     ← modified (ComponentToken + ThemeCollection.components)
├── utils/
│   ├── validation.ts                 ← modified (validateComponentName)
│   ├── config.ts                     ← modified (validate + deep-clone for components)
│   ├── prompts.ts                    ← NEW or reused (handleCancel helper extraction)
│   └── overrides.ts                  ← reused (from Story 2.2)
```

### References

- [Source: docs/planning/epics.md#Story 2.3: Guided Component Token Generation]
- [Source: docs/planning/architecture/adr-001-non-destructive-json-merge.md] — component tokens follow Option B (per-file ownership, `components` manifest)
- [Source: docs/planning/stories/2-1-advanced-mode-for-core-categories.md] — schema v2, `loadConfig` hardening, `$metadata` banner
- [Source: docs/planning/stories/2-2-add-subcommand-for-new-token-categories.md] — dynamic `json-writer`, pruner foundation, `rebuildCollectionFromConfig` helper, canonical category ordering
- [Source: docs/qds/design-tokens-nomenclature.md#Component Tokens] — the `<component>.<variant>.<property>.<state>` naming convention, reserved property + state vocabularies
- [Source: src/output/style-dictionary.ts#QUIETO_NAME_TRANSFORM] — tier-identifier injection pattern being extended to `component`
- [Source: src/output/json-writer.ts#writeTokensToJson] — existing writer being extended with `writeComponentTokens`
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — deferred items that remain out of scope

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
