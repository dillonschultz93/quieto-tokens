# Story 1.9: Config File Generation

Status: ready-for-dev

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

- [ ] Task 1: Define the config file schema (AC: #1, #2, #3, #4)
  - [ ] 1.1: Define `QuietoConfig` type in `src/types/config.ts`:
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
  - [ ] 1.2: Ensure the schema is forward-compatible — Epic 2 and 3 will add fields (advanced mode settings, additional categories, update history)
- [ ] Task 2: Create `src/output/config-writer.ts` — config serializer (AC: #1, #2, #3, #4)
  - [ ] 2.1: Implement `writeConfig(config: QuietoConfig, cwd: string): Promise<string>` — writes `quieto.config.json` to project root, returns file path
  - [ ] 2.2: Populate `version` from `package.json` (reuse the version reading pattern from `cli.ts`)
  - [ ] 2.3: Populate `generated` as `new Date().toISOString()`
  - [ ] 2.4: Populate `inputs` from the quick-start prompt answers (passed through the pipeline)
  - [ ] 2.5: Populate `overrides` from the override map (from Story 1.7, empty object if no overrides)
  - [ ] 2.6: Populate `output` with default paths used in Story 1.8
  - [ ] 2.7: Write as formatted JSON (`JSON.stringify(config, null, 2)`)
- [ ] Task 3: Update `src/utils/config.ts` — config reading (AC: #1)
  - [ ] 3.1: Add `loadConfig(cwd: string): QuietoConfig | null` — reads and parses existing `quieto.config.json`
  - [ ] 3.2: Add `CONFIG_FILENAME = 'quieto.config.json'` constant (already exists from Story 1.1)
  - [ ] 3.3: Add basic validation: check `version` field exists, warn if config version is newer than tool version
  - [ ] 3.4: This read function enables Story 1.1's existing config detection to load full config data for future re-entrant editing (Epic 3)
- [ ] Task 4: Implement final success message and "what's next" guide (AC: #5, #6)
  - [ ] 4.1: Use Clack `log.success()` for the completion announcement
  - [ ] 4.2: Display summary:
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
  - [ ] 4.3: Display "What's next" guide via Clack `log.info()`:
    ```
    What's next:
      • Import build/light.css into your project for CSS variables
      • Use --quieto-* custom properties in your styles
      • Re-run "quieto-tokens init" to modify your system
      • Run "quieto-tokens add shadow" to add new categories (coming soon)
    ```
  - [ ] 4.4: Confirm config persistence: "Config saved — you can re-run to modify your system anytime."
  - [ ] 4.5: Use Clack `outro()` as the final closing message
- [ ] Task 5: Integrate into init pipeline as the final step (AC: #1–#6)
  - [ ] 5.1: Wire config write after Story 1.8's file output
  - [ ] 5.2: Collect all pipeline data: prompt inputs (from 1.2), overrides (from 1.7), output paths (from 1.8)
  - [ ] 5.3: Build `QuietoConfig` object from collected data
  - [ ] 5.4: Write config, then display success message and outro
  - [ ] 5.5: Handle write errors gracefully

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
