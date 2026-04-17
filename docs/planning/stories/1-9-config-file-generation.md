# Story 1.9: Config File Generation

Status: done

## Story

As a **solo developer**,
I want my quick-start choices saved to a config file,
So that I can re-run the tool later to modify my token system without starting over.

## Acceptance Criteria

1. **Given** output files have been successfully written (Story 1.8), **When** the config generation step runs, **Then** a `quieto.config.json` file is written to the user's project root.
2. **Given** the config is written, **When** its contents are examined, **Then** it contains all quick-start inputs: brand color hex, spacing base, type scale preference, theme choice (light-only or light+dark).
3. **Given** the user made overrides in the preview step (Story 1.7), **When** the config is written, **Then** the config contains all semantic overrides the user made.
4. **Given** the config is written, **When** metadata is checked, **Then** the config contains metadata: tool version, generation timestamp.
5. **Given** all output and config are written, **When** the final step runs, **Then** a success message is displayed with the output directory path and a brief "what's next" guide.
6. **Given** generation is completing, **When** the final narrative runs, **Then** the progress narrative confirms "Config saved — you can re-run to modify your system anytime."

## Tasks / Subtasks

- [x] Task 1: Define the config file schema (AC: #1, #2, #3, #4)
  - [x] 1.1: Define `QuietoConfig` type in `src/types/config.ts`:
    ```typescript
    interface QuietoConfig {
      $schema?: string;
      version: string;          // Tool version (from package.json)
      generated: string;        // ISO 8601 timestamp
      inputs: {
        brandColor: string;     // Hex value
        spacingBase: 4 | 8;
        typeScale: 'compact' | 'balanced' | 'spacious';
        darkMode: boolean;
      };
      overrides: Record<string, string>;  // semantic path → primitive reference
      output: {
        tokensDir: string;      // Relative path, default "tokens"
        buildDir: string;       // Relative path, default "build"
        prefix: string;         // CSS prefix, default "quieto"
      };
    }
    ```
  - [x] 1.2: Ensure the schema is forward-compatible — Epic 2 and 3 will add fields (advanced mode settings, additional categories, update history)
- [x] Task 2: Create `src/output/config-writer.ts` — config serializer (AC: #1, #2, #3, #4)
  - [x] 2.1: Implement `writeConfig(config: QuietoConfig, cwd: string): Promise<string>` — writes `quieto.config.json` to project root, returns file path
  - [x] 2.2: Populate `version` from `package.json` (reuse the version reading pattern from `cli.ts`)
  - [x] 2.3: Populate `generated` as `new Date().toISOString()`
  - [x] 2.4: Populate `inputs` from the quick-start prompt answers (passed through the pipeline)
  - [x] 2.5: Populate `overrides` from the override map (from Story 1.7, empty object if no overrides)
  - [x] 2.6: Populate `output` with default paths used in Story 1.8
  - [x] 2.7: Write as formatted JSON (`JSON.stringify(config, null, 2)`)
- [x] Task 3: Update `src/utils/config.ts` — config reading (AC: #1)
  - [x] 3.1: Add `loadConfig(cwd: string): QuietoConfig | null` — reads and parses existing `quieto.config.json`
  - [x] 3.2: Add `CONFIG_FILENAME = 'quieto.config.json'` constant (already exists from Story 1.1)
  - [x] 3.3: Add basic validation: check `version` field exists, warn if config version is newer than tool version
  - [x] 3.4: This read function enables Story 1.1's existing config detection to load full config data for future re-entrant editing (Epic 3)
- [x] Task 4: Implement final success message and "what's next" guide (AC: #5, #6)
  - [x] 4.1: Use Clack `log.success()` for the completion announcement
  - [x] 4.2: Display summary:
    ```
    ✓ Token system generated successfully!
    
    Files created:
      tokens/primitive/color.json
      tokens/primitive/spacing.json
      tokens/primitive/typography.json
      tokens/semantic/light/color.json
      tokens/semantic/dark/color.json
      build/primitives.css
      build/light.css
      build/dark.css
      quieto.config.json
    ```
  - [x] 4.3: Display "What's next" guide via Clack `log.info()`:
    ```
    What's next:
      • Import build/light.css into your project for CSS variables
      • Use --quieto-* custom properties in your styles
      • Re-run "quieto-tokens init" to modify your system
      • Run "quieto-tokens add shadow" to add new categories (coming soon)
    ```
  - [x] 4.4: Confirm config persistence: "Config saved — you can re-run to modify your system anytime."
  - [x] 4.5: Use Clack `outro()` as the final closing message
- [x] Task 5: Integrate into init pipeline as the final step (AC: #1–#6)
  - [x] 5.1: Wire config write after Story 1.8's file output
  - [x] 5.2: Collect all pipeline data: prompt inputs (from 1.2), overrides (from 1.7), output paths (from 1.8)
  - [x] 5.3: Build `QuietoConfig` object from collected data
  - [x] 5.4: Write config, then display success message and outro
  - [x] 5.5: Handle write errors gracefully

### Review Findings

- [x] [Review][Patch] `writeConfig` is not atomic — crash / SIGINT mid-write can truncate an existing config [src/output/config-writer.ts:71-79] — fixed via write-to-`.tmp`-then-rename
- [x] [Review][Patch] `loadConfig` uses `existsSync`+`readFileSync` (TOCTOU) and mixes sync with the module's async peers [src/utils/config.ts:78-84] — dropped `existsSync`, rely on `readFileSync` + catch
- [x] [Review][Patch] `loadConfig` does not strip UTF-8 BOM before `JSON.parse` — BOM-prefixed files silently return `null` [src/utils/config.ts:87-93] — strip leading `\uFEFF` before parse
- [x] [Review][Patch] `readToolVersion` loses the last candidate's error detail in its thrown message [src/output/config-writer.ts:14-35] — track last error and append its message
- [x] [Review][Patch] `DEFAULT_OUTPUT_CONFIG` exported as a mutable object — importers can poison subsequent `buildConfig` calls [src/types/config.ts:54-58] — `Object.freeze` + `Readonly<...>`
- [x] [Review][Patch] Config-write failure path in `runConfigGeneration` has no closing `outro`/`cancel` — user gets an abrupt exit [src/pipeline/config.ts:50-58, src/commands/init.ts:100-108] — added closing `p.outro` on both failure branches
- [x] [Review][Patch] `readToolVersion` is exported as public API — leaky abstraction tied to this package's install path [src/index.ts:65-69] — removed from the public re-export
- [x] [Review][Defer] Extract shared `package.json` version resolution between `cli.ts` and `config-writer.ts` [src/cli.ts:28-37, src/output/config-writer.ts:14-35] — deferred, touches Story 1.1 scope
- [x] [Review][Defer] `compareVersions` semver fidelity gaps (pre-release / `v` prefix / `+build` / non-numeric) [src/utils/config.ts:18-36] — deferred, `loadConfig` is test-only until Epic 3
- [x] [Review][Defer] `loadConfig` does no structural validation past `version` — any JSON with a `version` string passes through [src/utils/config.ts:87-100] — deferred, Epic 3 consumers will dictate validation shape
- [x] [Review][Defer] `loadConfig` returns `null` for both "missing" and "corrupt" — callers cannot disambiguate [src/utils/config.ts:73-100] — deferred, Epic 3 consumers
- [x] [Review][Defer] `loadConfig` warns via `console.warn` instead of Clack — inconsistent with rest of CLI [src/utils/config.ts:99-102] — deferred, align when wired into user-facing path
- [x] [Review][Defer] Concurrent `init` runs can race on `writeFile` [src/pipeline/config.ts:56-65] — deferred, low likelihood for solo-dev tool
- [x] [Review][Defer] `formatPath.startsWith("..")` edge case matches filenames like `..foo.css` [src/pipeline/config.ts:19-22, src/pipeline/output.ts:~17-20] — deferred, pattern inherited from `output.ts`; fix in shared helper

## Dev Notes

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | @clack/prompts | ^1.2.0 |

### Architecture Constraints

- **ESM-only** — all imports use ESM syntax.
- **JSON format for config** — `quieto.config.json` (not YAML). JSON is simpler, requires no additional dependencies, and is natively parseable in Node.js. The epic mentioned `.yaml` as an option but JSON aligns with the existing config detection in Story 1.1 (`configExists()` checks for `quieto.config.json`).
- **Config is the re-runnable recipe:** This file is central to re-entrant editing (Epic 3). Every input and override must be captured so a future `quieto-tokens update` can recreate the full pipeline context.
- **Config file lives in user's project root:** Written to `process.cwd()`, alongside `tokens/` and `build/`.

### Config Schema Design

The schema must be **forward-compatible**. Future stories will extend it:
- **Story 2.1 (Advanced mode):** Will add `advanced: { color: { additionalHues: [...] }, spacing: { customValues: [...] }, typography: { fontFamily, lineHeight, letterSpacing } }`
- **Story 2.2 (Add command):** Will add `categories: { shadow: {...}, border: {...} }`
- **Story 3.1 (Re-entrant editing):** Will read and merge config changes
- **Story 3.4 (Changelog):** May add `history: [...]` or reference a separate changelog file

Use a flat, well-namespaced schema. Avoid deeply nested structures that are hard to extend.

### Connecting to Story 1.1's Config Detection

Story 1.1 already implemented:
- `configExists(cwd)` — checks for `quieto.config.json`
- `getConfigPath(cwd)` — returns the full path
- Init command behavior: if config exists, prompt "Modify existing system" or "Start fresh"

This story completes the config lifecycle:
1. **Story 1.1:** Detect config existence (done)
2. **Story 1.9:** Write config after generation (this story)
3. **Epic 3:** Read and modify config for re-entrant editing (future)

### Pipeline Data Flow

The config writer needs data from every prior story in the pipeline:

| Data | Source Story | How to Access |
|------|-------------|---------------|
| Brand color hex | 1.2 (prompt flow) | Passed through pipeline context |
| Spacing base | 1.2 (prompt flow) | Passed through pipeline context |
| Type scale preference | 1.2 (prompt flow) | Passed through pipeline context |
| Dark mode choice | 1.2 (prompt flow) | Passed through pipeline context |
| Semantic overrides | 1.7 (preview/override) | Override map from preview step |
| Output paths | 1.8 (file output) | Paths used by json-writer and SD |
| Tool version | package.json | Read from package.json |

**Pipeline context object recommendation:** Create a `PipelineContext` type that accumulates data through each step, making it easy for the config writer to access everything.

### What NOT to Build

- Do NOT implement config loading for re-entrant editing (Epic 3)
- Do NOT implement `$schema` URL pointing to a hosted JSON schema (nice-to-have, not MVP)
- Do NOT implement config migration between versions
- Do NOT implement `quieto.config.yaml` — JSON only for now

### File Structure

```
src/
├── output/
│   ├── json-writer.ts              # From Story 1.8
│   ├── style-dictionary.ts         # From Story 1.8
│   └── config-writer.ts            # NEW — config file serialization
├── types/
│   ├── tokens.ts                   # From previous stories
│   └── config.ts                   # NEW — QuietoConfig type definition
├── utils/
│   └── config.ts                   # MODIFIED — add loadConfig() alongside existing configExists()
```

### Previous Story Intelligence

- **Config detection from 1.1:** `configExists()` and `getConfigPath()` in `src/utils/config.ts` — reuse the `CONFIG_FILENAME` constant
- **Clack APIs from 1.1:** `log.success()`, `log.info()`, `outro()` for the success flow
- **Error handling from 1.1:** Top-level catch with `p.cancel()`, file write errors should be caught and displayed via Clack
- **Output paths from 1.8:** The json-writer and SD integration will establish the actual paths used — config should record these exact paths

### Git Intelligence

- Story 1.1 established the `quieto.config.json` filename convention
- The init command flow currently ends with `p.outro("Done — thanks for using quieto-tokens.")` — this story replaces that with the real success message and outro

### References

- [Source: docs/planning/epics.md#Story 1.9] — Acceptance criteria and story statement
- [Source: docs/brainstorming/brainstorming-session-2026-04-16-1200.md#Green Hat] — "The quieto.config File: Recipe file saved alongside output, re-runnable" (#32)
- [Source: docs/brainstorming/brainstorming-session-2026-04-16-1200.md#Blue Hat] — Phase 1 MVP includes `quieto.config` file
- [Source: docs/planning/stories/1-1-cli-scaffolding-and-init-entry-point.md] — Config detection and filename convention
- [Source: src/utils/config.ts] — Existing `configExists()`, `getConfigPath()`, `CONFIG_FILENAME`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (Cursor)

### Debug Log References

- `npm run type-check` — clean, no errors.
- `npm test` — 17 test files, 249 tests passing (adds 31 new tests across `config-writer`, `utils/config`, and `pipeline/config`).
- `npm run build` — tsup ESM + DTS build succeeds.

### Completion Notes List

- Added `QuietoConfig` type in `src/types/config.ts` with a forward-compatible, flat shape (`inputs` / `overrides` / `output`) plus an exported `DEFAULT_OUTPUT_CONFIG` so the writer and schema stay in sync. `$schema` is optional/reserved — deliberately not populated in MVP per story guidance.
- `src/output/config-writer.ts` exposes three pieces: `readToolVersion()` (resolves from `package.json`, works in both `dist/` runtime and `src/` test contexts), pure `buildConfig()` (easy to unit-test), and `writeConfig()` (writes pretty-printed JSON with trailing newline).
- Extended `src/utils/config.ts` with `loadConfig()` and exported `CONFIG_FILENAME`. Validation is lenient-safe: returns `null` for missing/malformed/missing-`version` files, warns via `console.warn` when the config version is newer than the tool (compared with a coarse numeric semver tokenizer that ignores pre-release tags).
- Created `src/pipeline/config.ts` — the final pipeline step. Narrates via Clack (`log.step` → `log.success` with the full file list → `log.info` with the "What's next" guide → `outro` with the AC #6 "Config saved" line). Catches write errors and returns `false` so `init` can set `process.exitCode = 1` without throwing through Clack.
- Wired `runConfigGeneration` into `src/commands/init.ts` after `runOutputGeneration`, replacing the placeholder "Done — thanks for using quieto-tokens." outro. Overrides come from `previewResult.overrides`.
- Updated `src/index.ts` to export the new config public API (`QuietoConfig`, `buildConfig`, `writeConfig`, `runConfigGeneration`, `loadConfig`, etc.) so downstream consumers (and future stories) can import them without reaching into internals.
- AC coverage:
  - **AC #1** — `writeConfig` + pipeline writes `quieto.config.json` in the project root; verified end-to-end in `pipeline/__tests__/config.test.ts`.
  - **AC #2** — `buildConfig` maps quick-start inputs (brand color, spacing base, type scale, darkMode) into `inputs`; verified in `config-writer.test.ts`.
  - **AC #3** — `overrides` Map is serialized via `Object.fromEntries` and round-trips through JSON; covered in `config-writer.test.ts` and the pipeline integration test.
  - **AC #4** — `version` read from `package.json`; `generated` from `new Date().toISOString()`; covered in `config-writer.test.ts`.
  - **AC #5** — Clack `log.success` emits the "Token system generated successfully!" + "Files created:" block with relative paths; verified via mocked Clack in `pipeline/__tests__/config.test.ts`.
  - **AC #6** — The exact outro string "Config saved — you can re-run to modify your system anytime." is asserted verbatim in the pipeline test.

### File List

- `src/types/config.ts` (new) — `QuietoConfig` interface + `DEFAULT_OUTPUT_CONFIG`.
- `src/output/config-writer.ts` (new) — `readToolVersion`, `buildConfig`, `writeConfig`.
- `src/output/__tests__/config-writer.test.ts` (new) — 14 tests covering mapping, serialization, and filesystem errors.
- `src/utils/config.ts` (modified) — added `CONFIG_FILENAME` export, `loadConfig`, `LoadConfigOptions`, internal semver comparator.
- `src/utils/__tests__/config.test.ts` (new) — 11 tests covering filename constant, `configExists`, `loadConfig` happy/invalid paths, and version warning.
- `src/pipeline/config.ts` (new) — `runConfigGeneration` orchestrator with Clack narrative and outro.
- `src/pipeline/__tests__/config.test.ts` (new) — 5 tests covering config write, files-created summary, AC-#6 outro text, what's-next guide, and write-failure handling.
- `src/commands/init.ts` (modified) — imports and invokes `runConfigGeneration` as the final pipeline step, removed placeholder outro.
- `src/index.ts` (modified) — exports new public APIs.
- `docs/planning/sprint-status.yaml` (modified) — flipped `1-9-config-file-generation` from `ready-for-dev` → `in-progress` → `review`.

## Change Log

| Date       | Change                                                                 | Author |
|------------|------------------------------------------------------------------------|--------|
| 2026-04-16 | Story 1.9 implementation: config file generation + final success outro | Dev    |
| 2026-04-16 | Code review: 7 patches applied (atomic write, BOM, TOCTOU, error detail, frozen defaults, failure outro, public API trim); 7 items deferred to `deferred-work.md` | Review |
