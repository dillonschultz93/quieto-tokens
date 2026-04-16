# Story 1.8: DTCG JSON and CSS Output via Style Dictionary

Status: ready-for-dev

## Story

As a **solo developer**,
I want my token system written as DTCG-aligned JSON source files and CSS custom properties,
So that I have a standards-compliant source of truth and immediately usable CSS variables.

## Acceptance Criteria

1. **Given** the user has confirmed the token preview (Story 1.7), **When** the output step runs, **Then** DTCG JSON source files are written to `tokens/primitive/` and `tokens/semantic/` directories in the user's project.
2. **Given** JSON files are written, **When** the format is validated, **Then** JSON files use `$type`, `$value`, and `$description` per DTCG spec.
3. **Given** semantic tokens are written, **When** references are checked, **Then** semantic tokens use DTCG reference syntax to point to primitives (e.g., `"{color.blue.500}"`).
4. **Given** JSON source files exist, **When** Style Dictionary v5 processes them, **Then** CSS custom properties are output to a `build/` directory.
5. **Given** CSS variables are generated, **When** naming is checked, **Then** CSS variables follow the naming convention with the user's global prefix (`--quieto-*`).
6. **Given** themes exist, **When** CSS is generated, **Then** theme variants are output as separate CSS files or scoped under class/attribute selectors.
7. **Given** files are being written, **When** each file is saved, **Then** the progress narrative confirms each file written with its path.

## Tasks / Subtasks

- [ ] Task 1: Install Style Dictionary v5 as a runtime dependency (AC: #4)
  - [ ] 1.1: `npm install style-dictionary@^5` — add as a runtime dependency (it runs as part of the CLI)
  - [ ] 1.2: Verify Style Dictionary v5 API: programmatic usage with `StyleDictionary` class, DTCG format support, custom platforms
- [ ] Task 2: Create `src/output/json-writer.ts` — DTCG JSON serializer (AC: #1, #2, #3)
  - [ ] 2.1: Implement `writeTokensToJson(collection: ThemeCollection, outputDir: string): Promise<string[]>` — returns list of written file paths
  - [ ] 2.2: Serialize primitive tokens to `tokens/primitive/color.json`, `tokens/primitive/spacing.json`, `tokens/primitive/typography.json`
  - [ ] 2.3: Serialize semantic tokens per theme: `tokens/semantic/light/color.json`, `tokens/semantic/dark/color.json`, etc.
  - [ ] 2.4: JSON format per DTCG spec:
    ```json
    {
      "color": {
        "blue": {
          "400": {
            "$type": "color",
            "$value": "#60A5FA",
            "$description": "Primary blue, step 400"
          }
        }
      }
    }
    ```
  - [ ] 2.5: Semantic tokens use reference syntax: `"$value": "{color.blue.500}"`
- [ ] Task 3: Create `src/output/style-dictionary.ts` — SD v5 integration (AC: #4, #5, #6)
  - [ ] 3.1: Create a programmatic Style Dictionary configuration:
    - Source: `tokens/primitive/**/*.json` + `tokens/semantic/<theme>/**/*.json`
    - Platform: `css` with format `css/variables`
    - Prefix: `quieto` (the global prefix)
    - Build path: `build/`
  - [ ] 3.2: For each theme, run SD with the shared primitives + that theme's semantics
  - [ ] 3.3: Output CSS files:
    - Shared primitives: `build/primitives.css` (or included in each theme file)
    - Light theme: `build/light.css` (or `build/tokens.css` with `:root` scope)
    - Dark theme: `build/dark.css` (scoped under `[data-theme="dark"]` or `.theme-dark` selector)
  - [ ] 3.4: If single theme (no dark mode), output `build/tokens.css` with `:root` scope
  - [ ] 3.5: CSS variable format: `--quieto-color-blue-400: #60A5FA;`, `--quieto-semantic-color-background-primary: var(--quieto-color-blue-500);`
- [ ] Task 4: Implement progress narrative for file output (AC: #7)
  - [ ] 4.1: Narrate each JSON file written: "Writing tokens/primitive/color.json..."
  - [ ] 4.2: Narrate Style Dictionary build: "Building CSS custom properties..."
  - [ ] 4.3: Narrate each CSS file output: "Generated build/light.css (78 variables)"
  - [ ] 4.4: Use Clack `log.step()` for phase headers, `log.info()` for file details
- [ ] Task 5: Integrate into init pipeline (AC: #1–#7)
  - [ ] 5.1: Wire output step after Story 1.7's confirmation
  - [ ] 5.2: Determine output directory relative to `process.cwd()` (the user's project root)
  - [ ] 5.3: Create output directories if they don't exist (`tokens/`, `build/`)
  - [ ] 5.4: Handle write errors gracefully — if directory creation or file write fails, display a clear error via Clack and suggest permissions or path fixes

## Dev Notes

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x |
| Build | tsup | ^8.x |
| CLI prompts | @clack/prompts | ^1.2.0 |
| Output engine | Style Dictionary | ^5.x (v5.4.0 is latest as of April 2026) |

### Style Dictionary v5 Critical Notes

**Style Dictionary is now at v5.4.0** (NOT v4 as originally planned). Key differences from v4:
- First-class DTCG format support with `$type`, `$value`, `$description`
- The DTCG format is used by default when `$value` keys are detected
- Programmatic API: `new StyleDictionary(config)` then `sd.buildAllPlatforms()`
- DTCG v2025.10 color types supported (structured color values, multiple color spaces)
- The `css/variables` format is a built-in format

**Programmatic usage example (v5 API):**
```typescript
import StyleDictionary from 'style-dictionary';

const sd = new StyleDictionary({
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: 'quieto',
      buildPath: 'build/',
      files: [{
        destination: 'tokens.css',
        format: 'css/variables',
        options: { selector: ':root' }
      }]
    }
  }
});

await sd.buildAllPlatforms();
```

**For themed output**, create separate SD configs per theme or use SD's `include`/`source` to swap semantic directories while keeping primitives constant.

### Architecture Constraints

- **ESM-only** — Style Dictionary v5 is ESM-compatible. Import as `import StyleDictionary from 'style-dictionary'`.
- **Output to user's project, not CLI's repo:** All file writes go to `process.cwd()` (the user's project root), not the `@quieto/tokens` package directory.
- **DTCG compliance is mandatory:** JSON source files MUST use `$type`, `$value` per DTCG spec. Do NOT use Style Dictionary's legacy `value` format.
- **CSS prefix is `quieto`:** All CSS custom properties use `--quieto-` prefix. This is set in the SD platform config.
- **Semantic tokens as CSS references:** Prefer that semantic CSS variables reference primitive CSS variables where possible (e.g., `--quieto-semantic-color-background-primary: var(--quieto-color-blue-500)`). This preserves the cascade and allows primitive overrides to propagate. Style Dictionary v5 may need a custom transform or the `outputReferences: true` option.

### Output Directory Structure

```
<user-project>/
├── tokens/
│   ├── primitive/
│   │   ├── color.json
│   │   ├── spacing.json
│   │   └── typography.json
│   └── semantic/
│       ├── light/
│       │   ├── color.json
│       │   ├── spacing.json
│       │   └── typography.json
│       └── dark/                    # Only if dark theme enabled
│           ├── color.json
│           ├── spacing.json
│           └── typography.json
├── build/
│   ├── primitives.css              # --quieto-color-blue-400, --quieto-spacing-4, etc.
│   ├── light.css                   # :root { --quieto-semantic-color-background-... }
│   └── dark.css                    # [data-theme="dark"] { ... }  (if dark theme enabled)
```

If single theme (no dark mode): `build/tokens.css` with both primitives and semantics under `:root`.

### CSS Theme Scoping Strategy

- **Light theme:** Scoped to `:root` (default, always active)
- **Dark theme:** Scoped to `[data-theme="dark"]` selector — this is the most common convention for CSS-based theme switching and works with any framework
- Alternative: separate files that can be loaded conditionally

### DTCG JSON Format

Primitive token example:
```json
{
  "color": {
    "blue": {
      "400": {
        "$type": "color",
        "$value": "#60A5FA"
      },
      "500": {
        "$type": "color",
        "$value": "#3B82F6"
      }
    }
  }
}
```

Semantic token example (light theme):
```json
{
  "color": {
    "background": {
      "primary": {
        "$type": "color",
        "$value": "{color.blue.500}"
      }
    }
  }
}
```

### `outputReferences` for CSS Variable Chaining

Style Dictionary's `outputReferences: true` option causes the CSS output to use `var()` references instead of resolved values:
```css
--quieto-semantic-color-background-primary: var(--quieto-color-blue-500);
```
This is the preferred output because it preserves the token hierarchy in CSS and allows primitive overrides to cascade to semantics.

### What NOT to Build

- Do NOT implement Figma/Tokens Studio JSON output (Story 4.1)
- Do NOT implement iOS or Android output (Stories 4.2, 4.3)
- Do NOT implement config file generation (Story 1.9)
- Do NOT add sourcemap generation for CSS
- Do NOT implement `--dry-run` behavior yet (Story 3.3)

### File Structure

```
src/
├── output/
│   ├── json-writer.ts              # NEW — DTCG JSON serialization to disk
│   └── style-dictionary.ts         # NEW — SD v5 programmatic config and build
├── generators/                     # From Stories 1.3–1.6
├── mappers/                        # From Story 1.5
├── ui/                             # From Story 1.7
├── types/
│   └── tokens.ts                   # May add OutputResult type
```

### Previous Story Intelligence

- **ThemeCollection from 1.6:** Contains primitives + themed semantics
- **Overrides from 1.7:** Map of semantic paths to new primitive references (already applied to in-memory tokens)
- **Token path arrays:** Each token has a `path` array that maps directly to the JSON nesting structure
- **Pipeline pattern:** Output step receives finalized, confirmed ThemeCollection

### References

- [Source: docs/planning/epics.md#Story 1.8] — Acceptance criteria and story statement
- [Source: docs/oss-tokens-system-planning.md] — Repository layout, tiered token directories, Style Dictionary config
- [Source: docs/brainstorming/brainstorming-session-2026-04-16-1200.md#Blue Hat] — Phase 1 MVP includes DTCG JSON + CSS output
- [Source: Style Dictionary v5.4.0] — Programmatic API, DTCG format support, `outputReferences`, `css/variables` format
- [Source: DTCG spec] — `$type`, `$value`, `$description` format, reference syntax

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
