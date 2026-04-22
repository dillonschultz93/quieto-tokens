# Story 4.2: iOS Swift Output

Status: ready-for-dev

## Story

As a **solo developer building an iOS app**,
I want my token system exported as Swift constants,
so that I can use the same design decisions in my iOS codebase without manual translation.

## Story Scope Note

This is the **second story of Epic 4** and builds on the multi-platform output architecture introduced in Story 4.1. The `outputs` config array and platform-selection prompt already exist. This story adds `"ios"` as a new output platform, producing Swift source files via Style Dictionary custom formatters.

**What this story IS:**
- A new Style Dictionary platform configuration (`ios`) producing Swift source files with token values as static constants.
- Color tokens output as `UIColor` / SwiftUI `Color` extensions.
- Spacing tokens output as `CGFloat` constants.
- Typography tokens output as font configuration structs or constants.
- Theme variants supported via conditional constants (compile-time theme switching).
- Output organized by token category into separate Swift files.
- Configurable output directory (defaults to `build/ios/`).

**What this story is NOT:**
- Not a Swift Package Manager package — this produces raw `.swift` files the developer copies or references.
- Not an Xcode project integration — no `.xcodeproj` or `.xcassets` generation.
- Not a replacement for CSS output — CSS is always generated.
- Not Android output — that's Story 4.3.

## Acceptance Criteria

### Config extension

1. **Given** Story 4.1's `OutputPlatform` type, **When** this story is implemented, **Then** `"ios"` is added as a valid `OutputPlatform` value.
2. **Given** the output platform selection prompt (Story 4.1), **When** the user runs `init`, **Then** iOS Swift appears as an additional option in the multi-select alongside CSS and Figma.
3. **Given** the user enables iOS output, **When** `quieto.config.json` is written, **Then** `outputs` includes `"ios"` (e.g., `["css", "ios"]`).

### Color token output

4. **Given** color primitive tokens exist, **When** iOS output is generated, **Then** a Swift file is produced with `UIColor` static constants (e.g., `static let blue500 = UIColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1.0)`).
5. **Given** color tokens, **When** the Swift file is generated, **Then** it also includes SwiftUI `Color` extensions (e.g., `static let blue500 = Color(uiColor: .blue500)` or equivalent).
6. **Given** semantic color tokens, **When** iOS output is generated, **Then** semantic colors reference their resolved values (not DTCG refs — iOS has no runtime reference resolution).

### Spacing token output

7. **Given** spacing tokens exist, **When** iOS output is generated, **Then** a Swift file is produced with `CGFloat` constants (e.g., `static let space4: CGFloat = 4`).
8. **Given** spacing values in CSS rem units, **When** converted to iOS, **Then** they are output as pixel values (the base unit for iOS layout).

### Typography token output

9. **Given** typography tokens exist (font size, font weight, line height), **When** iOS output is generated, **Then** a Swift file with font configuration constants is produced (e.g., `static let fontSizeLg: CGFloat = 18`).
10. **Given** font family tokens, **When** iOS output is generated, **Then** they are output as `String` constants referencing the font name.

### Theme support

11. **Given** a multi-theme token system (light + dark), **When** iOS output is generated, **Then** theme-specific semantic values are structured as conditional constants or separate namespaces (e.g., `Theme.light.colorBackgroundPrimary` / `Theme.dark.colorBackgroundPrimary`).
12. **Given** a single-theme system, **When** iOS output is generated, **Then** all tokens are in a single flat namespace.

### File organization

13. **Given** iOS output is generated, **When** the build directory is inspected, **Then** files are organized by category: `build/ios/Color.swift`, `build/ios/Spacing.swift`, `build/ios/Typography.swift`, etc.
14. **Given** the `output.buildDir` config, **When** iOS is enabled, **Then** Swift files are written to `<buildDir>/ios/`. The `ios` subdirectory is configurable but defaults to `ios`.

### Pipeline integration

15. **Given** `outputs` includes `"ios"`, **When** `runOutputGeneration` runs, **Then** Swift files are generated after CSS (and after Figma if enabled). An iOS build failure logs a warning but does not block CSS.
16. **Given** `--dry-run` mode, **When** the pipeline runs, **Then** no Swift files are written.

## Tasks / Subtasks

- [ ] **Task 1: Extend `OutputPlatform` type (AC: #1, #2, #3)**
  - [ ] 1.1: In `src/types/config.ts`, add `"ios"` to the `OutputPlatform` union.
  - [ ] 1.2: Update the output platform prompt in `init` to include the iOS option.

- [ ] **Task 2: iOS name transform (AC: #4, #7, #9)**
  - [ ] 2.1: In `src/output/style-dictionary.ts`, register a `name/ios` transform that converts token paths to camelCase Swift identifiers (e.g., `["color", "blue", "500"]` → `"blue500"`, `["spacing", "space-4"]` → `"space4"`).
  - [ ] 2.2: Semantic tokens get a `semantic` prefix in the identifier (e.g., `semanticColorBackgroundPrimary`). Component tokens get a `component` prefix.

- [ ] **Task 3: Custom iOS formats (AC: #4, #5, #6, #7, #8, #9, #10, #11)**
  - [ ] 3.1: Register a `ios/color-swift` format that outputs a Swift extension on `UIColor` with static color constants. Each color token becomes:
    ```swift
    static let blue500 = UIColor(red: 0.23, green: 0.51, blue: 0.96, alpha: 1.0)
    ```
  - [ ] 3.2: Include a SwiftUI `Color` companion extension.
  - [ ] 3.3: Register a `ios/spacing-swift` format that outputs `CGFloat` constants:
    ```swift
    static let space4: CGFloat = 4
    ```
  - [ ] 3.4: Register a `ios/typography-swift` format that outputs font size, weight, line-height, and font-family constants.
  - [ ] 3.5: For multi-theme, generate theme-aware structures — either `enum Theme { enum Light { ... } enum Dark { ... } }` or `@Environment(\.colorScheme)` conditional logic.

- [ ] **Task 4: `buildIos` orchestrator (AC: #13, #14, #15)**
  - [ ] 4.1: In `src/output/style-dictionary.ts`, export `buildIos(collection, outputDir): Promise<string[]>` following the `buildCss` pattern.
  - [ ] 4.2: Configure the `ios` platform with:
    - `buildPath`: `build/ios/`
    - `files`: one per category — `Color.swift`, `Spacing.swift`, `Typography.swift`, etc.
    - `transforms`: `["attribute/cti", "name/ios", "color/UIColorSwift", "size/swift/remToCGFloat"]` (use SD built-in iOS transforms where available, custom where needed).
  - [ ] 4.3: Handle multi-theme: separate SD runs per theme or merged output with conditional constants.

- [ ] **Task 5: Wire into output pipeline (AC: #15, #16)**
  - [ ] 5.1: In `src/pipeline/output.ts`, after Figma build (if enabled), check for `"ios"` in `outputs` and call `buildIos`.
  - [ ] 5.2: Extend `OutputResult` to include `iosFiles?: string[]`.
  - [ ] 5.3: iOS build failure logs warning, does not roll back other outputs.

- [ ] **Task 6: Tests (AC: all)**
  - [ ] 6.1: `src/output/__tests__/style-dictionary-ios.test.ts`:
    - `name/ios` transform produces camelCase identifiers.
    - `ios/color-swift` format produces valid UIColor + Color extensions.
    - `ios/spacing-swift` format produces CGFloat constants.
    - `ios/typography-swift` format produces font constants.
    - Multi-theme output has theme namespaces.
  - [ ] 6.2: Integration test: `runOutputGeneration` with `outputs: ["css", "ios"]` produces CSS + Swift files.
  - [ ] 6.3: `npm run type-check`, `npm test`, `npm run build`, `npm run validate:sprint` — all clean.

- [ ] **Task 7: Close-out**
  - [ ] 7.1: Update HELP_TEXT in `src/cli.ts` if needed.
  - [ ] 7.2: Update README.md to document iOS Swift output.
  - [ ] 7.3: Move this story to `review`, then to `done` after code review.

## Dev Notes

### Relevant ADRs

- **[ADR-001](../architecture/adr-001-non-destructive-json-merge.md)** — Swift files in `build/ios/` are derived artifacts, fully regenerated on each run. No merge logic needed.

### Previous Story Intelligence

**From Story 4.1 (Figma JSON output):**
- The `OutputPlatform` type, `outputs` config property, platform selection prompt, and `runOutputGeneration` multi-platform dispatch are all established by Story 4.1. This story extends them — do NOT recreate.
- `buildFigmaJson` in `src/output/style-dictionary.ts` follows the same pattern that `buildIos` should follow: register transforms/formats once, configure platform, run SD, return file paths.
- The `OutputResult` type already has `figmaFiles?: string[]` — add `iosFiles?: string[]` alongside it.

**From Story 1.8 (Style Dictionary):**
- `ensureQuietoTransformRegistered()` pattern for idempotent registration. Use the same boolean-flag guard for iOS transforms/formats.
- `silenceLogs()` with `brokenReferences: "throw"` — reuse for the iOS platform.
- Style Dictionary v5 has built-in iOS transforms: `color/UIColorSwift`, `size/swift/remToCGFloat`. Check if these exist in SD v5.4.0 and use them if available; create custom transforms only if SD doesn't provide them.

**From Story 3.3 (dry-run mode):**
- Dry-run suppression is handled at the `runOutputGeneration` level. No additional dry-run logic needed in `buildIos`.

### Style Dictionary iOS Transforms

Style Dictionary v5 provides several iOS-relevant built-in transforms and formats. Check `style-dictionary` v5.4.0 docs for:
- `color/UIColorSwift` — converts hex to UIColor rgba components
- `size/swift/remToCGFloat` — converts rem to CGFloat (base 16)
- `ios-swift/class.swift` — built-in format generating a Swift class
- `ios-swift/enum.swift` — built-in format generating a Swift enum

If SD v5's built-in iOS formats produce acceptable output, prefer them over custom formats. Only write custom formats if the built-in output doesn't match the token naming scheme (e.g., doesn't respect `name/ios` transform or doesn't handle theme variants correctly).

### Rem-to-Pixel Conversion

The token system stores spacing as dimension values (e.g., `"0.25rem"`). For iOS output, these must be converted to pixel values. Style Dictionary's `size/swift/remToCGFloat` uses a base of 16px. Verify this matches the project's `spacingBase` setting (4px or 8px refers to the step size, not the rem base — the rem base is always 16px in web contexts).

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

- **Do NOT generate an Xcode project, xcassets catalog, or SPM package.** This story outputs raw `.swift` files.
- **Do NOT add Android output.** That's Story 4.3.
- **Do NOT write a custom color conversion.** Use Style Dictionary's built-in `color/UIColorSwift` transform if available.
- **Do NOT make the iOS output a separate CLI command.** It's part of the multi-platform output pipeline.
- **Do NOT remove or modify existing CSS output behavior.** CSS is always generated.
- **Do NOT migrate `compareVersions`, extract the shared version resolver, or add lockfile protection.** All still deferred per `docs/planning/deferred-work.md`.

### File Structure (final target)

```
src/
├── output/
│   ├── style-dictionary.ts           ← modified (add buildIos, name/ios, ios/* formats)
│   ├── __tests__/
│   │   ├── style-dictionary-ios.test.ts  ← NEW
│   │   └── ...
│   └── ...
├── pipeline/
│   ├── output.ts                     ← modified (dispatch to buildIos)
│   └── ...
├── types/
│   ├── config.ts                     ← modified (add "ios" to OutputPlatform)
│   └── ...
```

### References

- [Source: docs/planning/epics.md#Story 4.2: iOS Swift Output]
- [Source: src/output/style-dictionary.ts] — SD config patterns, transform registration, buildCss
- [Source: src/types/config.ts] — QuietoConfig, OutputPlatform (from Story 4.1)
- [Source: src/pipeline/output.ts] — runOutputGeneration, OutputResult
- [Source: docs/planning/stories/4-1-json-output-for-figma-variables-and-tokens-studio.md] — outputs architecture, platform selection prompt
- [Source: docs/planning/deferred-work.md] — deferred items that remain out of scope

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
