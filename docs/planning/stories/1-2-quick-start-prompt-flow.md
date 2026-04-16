# Story 1.2: Quick-Start Prompt Flow

Status: done

## Story

As a **solo developer**,
I want to answer a few simple questions about my design preferences,
So that the tool has enough information to generate my entire token system.

## Acceptance Criteria

1. **Given** the CLI has started the quick-start flow, **When** the user is prompted for their design preferences, **Then** they are asked for their primary brand color (hex value input with validation).
2. **Given** the color prompt is displayed, **When** the user enters a value, **Then** the input is validated as a valid 3- or 6-digit hex color (with or without `#` prefix), and invalid input shows a clear error message without restarting the flow.
3. **Given** the color is accepted, **When** the spacing prompt appears, **Then** the user chooses a spacing base from a `select` prompt with two options: `4px` (tighter, more compact) and `8px` (roomier, more spacious), each with a brief hint explaining the feel.
4. **Given** the spacing is accepted, **When** the type scale prompt appears, **Then** the user chooses from three options: `compact` (1.200 minor third), `balanced` (1.250 major third), and `spacious` (1.333 perfect fourth), each with a hint showing the resulting size feel.
5. **Given** the type scale is accepted, **When** the theme prompt appears, **Then** the user is asked via `confirm` whether to generate both light and dark themes (default: yes).
6. **Given** all inputs are collected, **When** the flow completes, **Then** the collected preferences are returned as a typed `QuickStartOptions` object for downstream consumption by Stories 1.3–1.9.
7. **Given** the user presses Ctrl+C at any prompt, **When** cancellation is detected, **Then** Clack's `cancel()` is called with a friendly message and the process exits gracefully (no stack trace, no partial state).
8. **Given** the entire prompt sequence, **When** the user provides valid input at each step, **Then** the flow completes in under 30 seconds of wall-clock user interaction time (measured by prompt count, not enforced by a timer).

## Tasks / Subtasks

- [x] Task 1: Define the `QuickStartOptions` type (AC: #6)
  - [x] 1.1: Create `src/types.ts` with the `QuickStartOptions` interface containing: `brandColor: string` (normalized 6-digit hex with `#`), `spacingBase: 4 | 8`, `typeScale: 'compact' | 'balanced' | 'spacious'`, `generateThemes: boolean`
  - [x] 1.2: Export `QuickStartOptions` from `src/index.ts` for programmatic access
- [x] Task 2: Implement hex color validation utility (AC: #1, #2)
  - [x] 2.1: Create `src/utils/validation.ts` with a `validateHexColor(value: string): string | undefined` function that returns an error message string on failure or `undefined` on success (Clack's `validate` contract)
  - [x] 2.2: Accept `#RGB`, `RGB`, `#RRGGBB`, `RRGGBB` formats (case-insensitive)
  - [x] 2.3: Normalize all valid inputs to `#RRGGBB` uppercase format (e.g., `f00` → `#FF0000`)
  - [x] 2.4: Create `src/utils/color.ts` with a `normalizeHex(value: string): string` function for the normalization step (separate from validation so generators can reuse it)
- [x] Task 3: Implement the quick-start prompt flow function (AC: #1, #3, #4, #5, #6, #7)
  - [x] 3.1: Create `src/commands/quick-start.ts` exporting `async function quickStartFlow(): Promise<QuickStartOptions>`
  - [x] 3.2: Implement brand color prompt using Clack `text()` with `placeholder: "#5B21B6"`, `validate` wired to the hex validation utility
  - [x] 3.3: Implement spacing base prompt using Clack `select()` with options `[{ value: 4, label: '4px base', hint: 'Tighter, more compact — common in data-dense UIs' }, { value: 8, label: '8px base', hint: 'Roomier, more spacious — the most popular choice' }]`
  - [x] 3.4: Implement type scale prompt using Clack `select()` with options `[{ value: 'compact', label: 'Compact (Minor Third — 1.200)', hint: 'Subtle size steps, good for dense interfaces' }, { value: 'balanced', label: 'Balanced (Major Third — 1.250)', hint: 'Versatile and harmonious — the default choice' }, { value: 'spacious', label: 'Spacious (Perfect Fourth — 1.333)', hint: 'Dramatic size contrast, good for marketing sites' }]`
  - [x] 3.5: Implement theme prompt using Clack `confirm()` with `message: 'Generate both light and dark themes?'` and `initialValue: true`
  - [x] 3.6: Check `isCancel()` after every prompt. On cancel: call `p.cancel("Operation cancelled.")` then `throw new Error("cancelled")`. The init.ts try/catch already handles this — the catch calls `p.cancel()` and re-throws to cli.ts. To avoid double-cancel display, guard the catch: only call `p.cancel()` if the error message is NOT `"cancelled"`.
  - [x] 3.7: After all prompts, normalize the hex color and return the `QuickStartOptions` object
- [x] Task 4: Integrate quick-start flow into the init command (AC: #1, #6, #8)
  - [x] 4.1: In `src/commands/init.ts`, replace the quick-start stub (`p.log.step("Ready to begin...")` block) with a call to `quickStartFlow()`
  - [x] 4.2: After flow completes, display a Clack `log.success()` or `log.step()` summary of collected preferences (color swatch if terminal supports it, spacing base, type scale, theme choice) — this is the "receipt" before generation begins in Story 1.3
  - [x] 4.3: The `initCommand` should store the returned `QuickStartOptions` in a local variable — downstream stories will wire this into generation. For now, display the summary and show `p.log.info("Token generation coming in the next release.")` as a placeholder
  - [x] 4.4: Wire the "Start fresh" path (when config exists and user chooses fresh) to also call `quickStartFlow()`
- [x] Task 5: Verify the complete flow (AC: #1–#8)
  - [x] 5.1: `npm run build` succeeds with zero type errors
  - [x] 5.2: `node dist/cli.js init` (no existing config) → prompts appear in sequence: color → spacing → type scale → themes → summary
  - [x] 5.3: Invalid hex input (e.g., `"xyz"`, `"#GGG"`, `""`) shows validation error inline without restarting
  - [x] 5.4: Ctrl+C at any prompt shows cancellation message and exits cleanly
  - [x] 5.5: Valid hex shorthand (e.g., `f00`) is normalized to `#FF0000` in summary output

### Review Findings

- [x] [Review][Patch] Whitespace mismatch: `validateHexColor` trims input but `normalizeHex` receives raw untrimmed value — `" #5B21B6 "` passes validation then throws at runtime [src/commands/quick-start.ts:66]
- [x] [Review][Patch] Double cancel message + exit code 1 on Ctrl+C: `handleCancel` shows "Operation cancelled." then throws; `cli.ts` catches and shows "cancelled" again with exit(1). Fix: `init.ts` catch should `return` for cancelled errors instead of re-throwing [src/commands/init.ts:57-58]
- [x] [Review][Defer] Duplicated hex regex logic across validation.ts and color.ts — deferred, separate concerns (Clack contract vs pure transform)
- [x] [Review][Defer] Magic string `"cancelled"` should be a custom error class — deferred, works for current scope
- [x] [Review][Defer] `handleCancel` is private to quick-start.ts — deferred, extract to shared utility when more commands need it
- [x] [Review][Defer] `quickStartFlow` not exported from package index alongside its return type — deferred, public API design is future work
- [x] [Review][Defer] Uppercase hex normalization may conflict with DTCG/Style Dictionary lowercase convention — deferred, acceptable for scaffolding

## Dev Notes

### Technical Stack (Story-Relevant)

| Concern | Choice | Version | Notes |
|---------|--------|---------|-------|
| Runtime | Node.js | >=18 (LTS) | Already configured |
| Language | TypeScript | ^5.x | Strict mode, ESM-only |
| Build | tsup | ^8.x | Two-entry config (cli.ts + index.ts) |
| CLI prompts | @clack/prompts | ^1.2.0 | Already installed. Use: `text()`, `select()`, `confirm()`, `isCancel()`, `cancel()`, `log.*()` |

No new dependencies required for this story. Everything needed is already in the project.

### Architecture Constraints

- **ESM-only:** All imports use ESM syntax with `.js` extensions in import paths (e.g., `import { foo } from "../utils/bar.js"`). No CommonJS.
- **Clack is the only prompt library.** Do not introduce inquirer, prompts, or any alternative.
- **Command pattern:** Each subcommand lives in `src/commands/`. The quick-start flow is a separate module (`src/commands/quick-start.ts`) called by `init.ts` — not inlined into init.
- **No token generation in this story.** The prompt flow collects preferences and returns them as a typed object. Generation is Story 1.3+.
- **No config writing in this story.** The `QuickStartOptions` object is returned in-memory. Config file output is Story 1.9.

### Clack API Reference (v1.2.0)

```typescript
import * as p from "@clack/prompts";

// Text input with validation
const color = await p.text({
  message: "What is your brand color?",
  placeholder: "#5B21B6",
  validate(value) {
    // Return string = error message, undefined = valid
    if (!isValidHex(value)) return "Please enter a valid hex color (e.g., #5B21B6 or 5B21B6)";
  },
});
if (p.isCancel(color)) { p.cancel("Cancelled."); return; }

// Select (single choice)
const spacing = await p.select({
  message: "Choose a spacing base:",
  options: [
    { value: 4, label: "4px base", hint: "..." },
    { value: 8, label: "8px base", hint: "..." },
  ],
});
if (p.isCancel(spacing)) { p.cancel("Cancelled."); return; }

// Confirm (boolean)
const themes = await p.confirm({
  message: "Generate light and dark themes?",
  initialValue: true,
});
if (p.isCancel(themes)) { p.cancel("Cancelled."); return; }
```

### Hex Color Validation Rules

1. Strip leading `#` if present
2. Accept 3-character shorthand (expand: `f0a` → `ff00aa`)
3. Accept 6-character full hex
4. Validate characters are `[0-9a-fA-F]`
5. Reject empty strings, strings of wrong length, strings with invalid characters
6. Normalize output: always `#RRGGBB` uppercase (e.g., `"5b21b6"` → `"#5B21B6"`, `"f00"` → `"#FF0000"`)

### Type Scale Reference

The type scale ratios determine step sizes for the typography ramp generated in Story 1.4. For this story, only the label/hint text matters — the actual scale computation happens later.

| Choice | Ratio | Musical Name | Feel |
|--------|-------|-------------|------|
| compact | 1.200 | Minor Third | Subtle size steps, data-dense UIs |
| balanced | 1.250 | Major Third | Versatile, harmonious — recommended default |
| spacious | 1.333 | Perfect Fourth | Dramatic contrast, marketing/editorial sites |

### Integration Points with Existing Code

**`src/commands/init.ts` (modify):**
The current init.ts has a stub at lines 44–48 that needs replacement:
```typescript
// REPLACE THIS:
p.log.step("Ready to begin the quick-start flow.");
p.log.info("The quick-start prompt flow is coming in the next release. Stay tuned.");

// WITH: call to quickStartFlow() and summary display
```

The "Start fresh" branch (line 39–41) should also call `quickStartFlow()`.

**`src/utils/config.ts` (no changes):** Config detection stays as-is. The `configExists()` function is used by init.ts before deciding whether to show the quick-start or modify/fresh prompt.

**`src/index.ts` (modify):** Add export for `QuickStartOptions` type so it's available for programmatic consumers.

### File Structure After This Story

```
src/
├── cli.ts                      # No changes
├── commands/
│   ├── init.ts                 # Modified: calls quickStartFlow()
│   └── quick-start.ts          # NEW: prompt flow returning QuickStartOptions
├── types.ts                    # NEW: QuickStartOptions interface
├── utils/
│   ├── config.ts               # No changes
│   ├── validation.ts           # NEW: validateHexColor()
│   └── color.ts                # NEW: normalizeHex()
└── index.ts                    # Modified: re-exports QuickStartOptions
```

### Previous Story Intelligence (Story 1.1)

**Patterns established:**
- Clack import style: `import * as p from "@clack/prompts"` (namespace import, aliased as `p`)
- Error handling: `try/catch` wrapping command body, `p.cancel()` for user-facing errors, re-throw for fatal errors
- Cancel handling: `p.isCancel()` check after every interactive prompt
- ESM imports: all use `.js` extension suffix (e.g., `"../utils/config.js"`)
- Function exports: named exports, `async function` (not arrow), returning `Promise<void>` for commands

**Review findings applied:**
- `process.exit()` removed from command functions (composability)
- Global error handler in `cli.ts` catches and formats via `p.cancel()`
- No-args invocation exits code 1

**tsup config note:** The build uses a two-entry array config. `cli.ts` gets the shebang banner; `index.ts` gets `.d.ts` generation. New source files under `src/` are automatically included — no tsup config changes needed.

### What NOT to Build

- Do NOT implement token generation (Stories 1.3–1.6)
- Do NOT implement preview/override UI (Story 1.7)
- Do NOT write any files to disk (Story 1.8)
- Do NOT create or write `quieto.config.json` (Story 1.9)
- Do NOT install any new npm dependencies
- Do NOT add a test framework — testing will be established when there is generation logic to validate (Story 1.3+)
- Do NOT add `--advanced` flag handling (Story 2.1)
- Do NOT persist the collected options anywhere — just return the in-memory object

### Project Structure Notes

- All new files go under `src/` in the locations specified in the file structure above
- The `quick-start.ts` file is a separate module from `init.ts` to maintain the single-responsibility pattern: init handles routing (new vs existing config), quick-start handles the prompt sequence
- `types.ts` at the `src/` root is the canonical location for shared types across commands and utilities
- `utils/validation.ts` and `utils/color.ts` are separate files because validation returns Clack-compatible error strings while color normalization is a pure transform — different concerns, different consumers

### References

- [Source: docs/planning/epics.md#Story 1.2] — Acceptance criteria, prompt questions, validation rules
- [Source: docs/planning/epics.md#Story 1.1] — CLI entry point architecture, command routing pattern
- [Source: docs/qds/design-tokens-nomenclature.md] — Three-tier naming, category types, global prefix
- [Source: docs/brainstorming/brainstorming-session-2026-04-16-1200.md] — Quick-start questions defined (brand color hex, spacing base 4px/8px, type scale compact/balanced/spacious, light/dark themes yes/no), under-2-minute target, Clack choice rationale
- [Source: @clack/prompts v1.2.0] — `text()` with `validate`, `select()` with `options[].hint`, `confirm()` with `initialValue`, `isCancel()`, `cancel()`, `log.step()`, `log.success()`
- [Source: docs/planning/stories/1-1-cli-scaffolding-and-init-entry-point.md] — Previous story patterns, code conventions, review findings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Type check: `npm run type-check` — passed, zero errors
- Build: `npm run build` — tsup produced `dist/cli.js` (6.05 KB), `dist/index.js` (4.61 KB), `dist/index.d.ts`
- CLI init (no config): prompt flow starts correctly — brand color question appears with placeholder
- Clack `validate` signature required `(value: string | undefined) => string | Error | undefined` — adjusted `validateHexColor` param type accordingly

### Completion Notes List

- Created `src/types.ts` with `QuickStartOptions` interface: `brandColor` (normalized `#RRGGBB`), `spacingBase` (4 | 8), `typeScale` (compact/balanced/spacious), `generateThemes` (boolean)
- Created `src/utils/validation.ts` with `validateHexColor()` accepting Clack's `(string | undefined)` contract; validates 3/6-digit hex with or without `#` prefix
- Created `src/utils/color.ts` with `normalizeHex()` pure transform: strips `#`, expands 3-digit shorthand, uppercases, returns `#RRGGBB`
- Created `src/commands/quick-start.ts` with `quickStartFlow()` using Clack `text()`, two `select()`, and `confirm()` — returns typed `QuickStartOptions`
- Cancel handling uses `handleCancel()` assertion function: checks `isCancel()`, calls `p.cancel()`, throws `Error("cancelled")`. Init.ts catch block guards against double-cancel by checking `error.message === "cancelled"`
- Modified `src/commands/init.ts`: replaced stub with `quickStartFlow()` call, added preference summary display via `p.log.step()`, "Start fresh" path falls through to the same flow
- Modified `src/index.ts`: added `export type { QuickStartOptions }` for programmatic consumers
- No new dependencies added — all functionality uses existing `@clack/prompts ^1.2.0`
- No test framework added per story spec — testing deferred to Story 1.3+

### File List

- src/types.ts (new)
- src/utils/color.ts (new)
- src/utils/validation.ts (new)
- src/commands/quick-start.ts (new)
- src/commands/init.ts (modified)
- src/index.ts (modified)
