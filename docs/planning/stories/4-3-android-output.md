# Story 4.3: Android Output

Status: done

## Story

As a **solo developer building an Android app**,
I want my token system exported as Android-native resource formats,
so that I can use the same design decisions in my Android codebase without manual translation.

## Story Scope Note

This is the **third and final story of Epic 4** and builds on the multi-platform output architecture from Stories 4.1 and 4.2. The `outputs` config array, platform selection prompt, and per-platform dispatch in `runOutputGeneration` already exist. This story adds `"android"` as a new output platform, producing either XML resources or Jetpack Compose constants via Style Dictionary custom formatters.

**What this story IS:**
- A new Style Dictionary platform configuration (`android`) producing Android resource XML files (default) or Jetpack Compose Kotlin constants (configurable).
- Color tokens output as `<color>` resources in `colors.xml` (or Compose `Color` constants).
- Spacing tokens output as `<dimen>` resources in `dimens.xml` (or Compose `Dp` constants).
- Typography tokens output as appropriate Android type resources.
- Theme variants supported via Android resource qualifiers (`values/` vs `values-night/`) for XML, or Compose theming for Kotlin.
- Configurable output format (`xml` or `compose`) in `quieto.config.json`.
- Configurable output directory (defaults to `build/android/`).

**What this story is NOT:**
- Not an Android Gradle plugin or build integration.
- Not a replacement for CSS output — CSS is always generated.
- Not iOS output — that's Story 4.2.

## Acceptance Criteria

### Config extension

1. **Given** Story 4.1's `OutputPlatform` type, **When** this story is implemented, **Then** `"android"` is added as a valid `OutputPlatform` value.
2. **Given** the output platform selection prompt (Story 4.1), **When** the user selects Android, **Then** they are asked a follow-up: XML resources or Jetpack Compose.
3. **Given** the user enables Android output, **When** `quieto.config.json` is written, **Then** `outputs` includes `"android"` and a new `androidFormat: "xml" | "compose"` property records the chosen format.

### XML resource output (default)

4. **Given** Android XML output is selected, **When** color tokens are generated, **Then** a `colors.xml` file is produced with `<color>` resources:
   ```xml
   <color name="quieto_color_blue_500">#3B82F6</color>
   ```
5. **Given** Android XML output, **When** spacing tokens are generated, **Then** a `dimens.xml` file is produced with `<dimen>` resources:
   ```xml
   <dimen name="quieto_space_4">4dp</dimen>
   ```
6. **Given** Android XML output, **When** typography tokens are generated, **Then** appropriate resources are produced (font sizes as `<dimen>`, font families as `<string>` or `<font-family>`).

### Jetpack Compose output

7. **Given** Compose output is selected, **When** color tokens are generated, **Then** a Kotlin file is produced with `Color` constants:
   ```kotlin
   val Blue500 = Color(0xFF3B82F6)
   ```
8. **Given** Compose output, **When** spacing tokens are generated, **Then** `Dp` constants are produced:
   ```kotlin
   val Space4 = 4.dp
   ```
9. **Given** Compose output, **When** typography tokens are generated, **Then** `TextStyle` or font-related constants are produced.

### Theme support

10. **Given** a multi-theme system with Android XML output, **When** generation runs, **Then** light theme resources go to `values/` and dark theme resources go to `values-night/`. Primitives appear in both (or in a shared `values/` file).
11. **Given** a multi-theme system with Compose output, **When** generation runs, **Then** theme-aware `MaterialTheme`-compatible structures are generated (light/dark color schemes).
12. **Given** a single-theme system, **When** Android output is generated, **Then** all resources go to a single `values/` directory (XML) or single Kotlin file (Compose).

### File organization

13. **Given** Android XML output, **When** the build directory is inspected, **Then** files follow Android convention: `build/android/values/colors.xml`, `build/android/values/dimens.xml`, `build/android/values-night/colors.xml`, etc.
14. **Given** Compose output, **When** the build directory is inspected, **Then** Kotlin files are organized by category: `build/android/Color.kt`, `build/android/Spacing.kt`, `build/android/Typography.kt`.

### Pipeline integration

15. **Given** `outputs` includes `"android"`, **When** `runOutputGeneration` runs, **Then** Android files are generated after other platforms. A build failure logs a warning but does not block CSS.
16. **Given** `--dry-run` mode, **When** the pipeline runs, **Then** no Android files are written.

## Tasks / Subtasks

- [x] **Task 1: Extend `OutputPlatform` and config (AC: #1, #2, #3)**
  - [x] 1.1: In `src/types/config.ts`, add `"android"` to `OutputPlatform`.
  - [x] 1.2: Add `androidFormat?: "xml" | "compose"` to `QuietoConfig` (optional — only present when `outputs` includes `"android"`).
  - [x] 1.3: Update the output platform prompt to include Android. When Android is selected, show a follow-up prompt for XML vs Compose.
  - [x] 1.4: Thread `androidFormat` through `buildConfig` and config loading.

- [x] **Task 2: Android name transform (AC: #4, #5, #7, #8)**
  - [x] 2.1: For XML: register a `name/android-xml` transform producing underscore-separated resource names with the `quieto_` prefix (e.g., `quieto_color_blue_500`, `quieto_space_4`).
  - [x] 2.2: For Compose: register a `name/android-compose` transform producing PascalCase Kotlin identifiers (e.g., `Blue500`, `Space4`).

- [x] **Task 3: Custom Android formats (AC: #4, #5, #6, #7, #8, #9, #10, #11, #12)**
  - [x] 3.1: Register an `android/colors-xml` format producing:
    ```xml
    <?xml version="1.0" encoding="utf-8"?>
    <resources>
      <color name="quieto_color_blue_500">#3B82F6</color>
    </resources>
    ```
  - [x] 3.2: Register an `android/dimens-xml` format producing `<dimen>` resources.
  - [x] 3.3: Register an `android/typography-xml` format for font-related resources.
  - [x] 3.4: Register `android/color-compose` format producing Kotlin `Color` constants in an `object QuietoTokens`.
  - [x] 3.5: Register `android/spacing-compose` format producing `Dp` constants.
  - [x] 3.6: Register `android/typography-compose` format producing `TextStyle` constants.
  - [x] 3.7: Multi-theme XML: run separate SD builds — light tokens → `values/`, dark tokens → `values-night/`.
  - [x] 3.8: Multi-theme Compose: generate `lightColorScheme()` and `darkColorScheme()` compatible structures.

- [x] **Task 4: `buildAndroid` orchestrator (AC: #13, #14, #15)**
  - [x] 4.1: In `src/output/style-dictionary.ts`, export `buildAndroid(collection, outputDir, format): Promise<string[]>`. The `format` parameter (`"xml" | "compose"`) selects which transforms and formats to use.
  - [x] 4.2: For XML: `buildPath` is `build/android/values/` (light) and `build/android/values-night/` (dark).
  - [x] 4.3: For Compose: `buildPath` is `build/android/`.
  - [x] 4.4: Follow the `buildCss` decomposition pattern for multi-theme handling.

- [x] **Task 5: Wire into output pipeline (AC: #15, #16)**
  - [x] 5.1: In `src/pipeline/output.ts`, after iOS build (if enabled), check for `"android"` in `outputs` and call `buildAndroid` with the `androidFormat` from config.
  - [x] 5.2: Extend `OutputResult` to include `androidFiles?: string[]`.
  - [x] 5.3: Android build failure logs warning, does not roll back other outputs.

- [x] **Task 6: Tests (AC: all)**
  - [x] 6.1: `src/output/__tests__/style-dictionary-android.test.ts`:
    - XML transforms produce underscore-separated resource names.
    - Compose transforms produce PascalCase identifiers.
    - `android/colors-xml` format produces valid XML resources.
    - `android/dimens-xml` format produces valid `<dimen>` resources.
    - `android/color-compose` format produces valid Kotlin Color constants.
    - `android/spacing-compose` format produces valid Kotlin Dp constants.
    - Multi-theme XML outputs to `values/` and `values-night/`.
    - Multi-theme Compose generates light/dark schemes.
  - [x] 6.2: Integration test: `runOutputGeneration` with `outputs: ["css", "android"]` produces CSS + Android files.
  - [x] 6.3: Config round-trip: `androidFormat` persists correctly.
  - [x] 6.4: `npm run type-check`, `npm test`, `npm run build`, `npm run validate:sprint` — all clean.

- [x] **Task 7: Close-out**
  - [x] 7.1: Update HELP_TEXT in `src/cli.ts` if needed.
  - [x] 7.2: Update README.md to document Android output and XML vs Compose options.
  - [x] 7.3: Move this story to `review`, then to `done` after code review.

## Dev Notes

### Relevant ADRs

- **[ADR-001](../architecture/adr-001-non-destructive-json-merge.md)** — Android resource files in `build/android/` are derived artifacts, fully regenerated on each run.

### Previous Story Intelligence

**From Story 4.1 (Figma JSON output):**
- The `OutputPlatform` type, `outputs` config property, platform selection prompt, and `runOutputGeneration` multi-platform dispatch are all established. Add `"android"` to the union and dispatch.
- Pattern: register transforms/formats once → configure platform → run SD → return file paths.

**From Story 4.2 (iOS Swift output):**
- `buildIos` follows the same orchestrator pattern. `buildAndroid` should mirror it.
- The `name/ios` transform for camelCase identifiers is separate from `name/android-compose` (PascalCase) — do not reuse.
- `OutputResult` already has `iosFiles?: string[]` — add `androidFiles?: string[]`.

**From Story 1.8 (Style Dictionary):**
- `ensureQuietoTransformRegistered()` pattern for idempotent registration.
- `silenceLogs()` with `brokenReferences: "throw"` — reuse.
- Style Dictionary v5 has built-in Android formats. Check v5.4.0 for: `android/resources`, `android/colors`, `android/dimens`, `compose/object`. Use built-ins where they match requirements; custom formats only where needed.

### Style Dictionary Android Built-ins

Style Dictionary v5 provides Android-relevant transforms and formats. Check v5.4.0 docs for:
- `color/hex8android` — converts hex to `#AARRGGBB` (Android format, alpha first)
- `size/remToDp` — converts rem to dp
- `android/resources` — built-in format for `resources.xml`
- `android/colors` — built-in format for `colors.xml`
- `android/dimens` — built-in format for `dimens.xml`
- `compose/object` — built-in Compose token object format

Prefer built-in SD formats where they produce acceptable output. Only write custom formats if the built-in naming or structure doesn't match the `quieto_` prefix convention or theme variant requirements.

### Android Resource Qualifiers

Android uses directory-based resource qualifiers for theming:
- `values/colors.xml` — default (light) theme
- `values-night/colors.xml` — dark theme override

Only semantic/component tokens differ between themes. Primitive tokens are shared and go in the default `values/` directory. This mirrors the CSS approach where primitives go in `:root` and semantics switch per theme.

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | `@clack/prompts` | ^1.2.0 |
| Test runner | Vitest | ^4.x |
| Output transforms | Style Dictionary | ^5.4.0 |
| Color engine | `@quieto/engine` | ^0.1.1 |

### What NOT to Build

- **Do NOT generate a Gradle plugin or build.gradle integration.** This story outputs raw resource/Kotlin files.
- **Do NOT add new CLI commands.** Android is part of the multi-platform output pipeline.
- **Do NOT remove or modify CSS output.** CSS is always generated.
- **Do NOT add iOS output.** That's Story 4.2.
- **Do NOT generate Android Themes/Styles XML.** Token values as simple resources and Compose constants are sufficient for MVP.
- **Do NOT migrate `compareVersions`, extract the shared version resolver, or add lockfile protection.** All still deferred per `docs/planning/deferred-work.md`.

### File Structure (final target)

```
src/
├── output/
│   ├── style-dictionary.ts           ← modified (add buildAndroid, name/android-*, android/* formats)
│   ├── __tests__/
│   │   ├── style-dictionary-android.test.ts  ← NEW
│   │   └── ...
│   └── ...
├── pipeline/
│   ├── output.ts                     ← modified (dispatch to buildAndroid)
│   └── ...
├── types/
│   ├── config.ts                     ← modified (add "android" to OutputPlatform, androidFormat)
│   └── ...
```

### References

- [Source: docs/planning/epics.md#Story 4.3: Android Output]
- [Source: src/output/style-dictionary.ts] — SD config patterns, transform registration, buildCss
- [Source: src/types/config.ts] — QuietoConfig, OutputPlatform (from Story 4.1)
- [Source: src/pipeline/output.ts] — runOutputGeneration, OutputResult
- [Source: docs/planning/stories/4-1-json-output-for-figma-variables-and-tokens-studio.md] — outputs architecture
- [Source: docs/planning/stories/4-2-ios-swift-output.md] — iOS patterns, OutputResult extension
- [Source: docs/planning/deferred-work.md] — deferred items that remain out of scope

## Dev Agent Record

### Agent Model Used

Claude (Cursor agent)

### Debug Log References

### Completion Notes List

- Implemented `buildAndroid` with Style Dictionary custom formats: XML via `name/android-xml` (underscore resource names) and `android/*-xml` formats; Compose via `name/android-compose` and `QuietoColors` / `QuietoSpacing` / `QuietoTypography` object wrappers per file (per-category names avoid duplicate object name clashes). Multi-theme Compose merges per-theme `formatPlatform` output into `ThemeColors` / `ThemeSpacing` / `ThemeTypography` and appends Material3 `ColorScheme` bridges. Multi-theme XML runs full light build to `values/`, then dark semantic/component-only build to `values-night/`.
- Config: `OutputPlatform` + `androidFormat`; `loadConfig` defaults `androidFormat` to `xml` when `android` is in `outputs`. Init prompts for Android format when Android is selected. Pipeline passes `androidFormat` through `runOutputGeneration` and `buildConfig`; add/update/component rebuild Android when enabled. Dry run still skips all Android writes because `init` / other commands exit before `runOutputGeneration`.
- `validate:sprint` requires story file and sprint-status for `4-3-android-output` to match.

### File List

- `src/types/config.ts`
- `src/utils/config.ts`
- `src/output/config-writer.ts`
- `src/output/style-dictionary.ts`
- `src/pipeline/output.ts`
- `src/pipeline/config.ts`
- `src/pipeline/add.ts`
- `src/pipeline/component.ts`
- `src/commands/init.ts`
- `src/commands/update.ts`
- `src/index.ts`
- `src/cli.ts`
- `README.md`
- `src/output/__tests__/style-dictionary-android.test.ts`
- `src/output/__tests__/config-writer.test.ts`
- `src/pipeline/__tests__/output-android.test.ts`
- `docs/planning/sprint-status.yaml`
- `docs/planning/stories/4-3-android-output.md`
