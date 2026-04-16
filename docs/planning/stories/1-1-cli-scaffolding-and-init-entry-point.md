# Story 1.1: CLI Scaffolding and Init Entry Point

Status: ready-for-dev

## Story

As a **solo developer**,
I want to run `npx @quieto/tokens init` and be greeted with a clear, beautiful CLI interface,
So that I know I'm using a professional tool that will guide me through token creation.

## Acceptance Criteria

1. **Given** the user has Node.js installed, **When** they run `npx @quieto/tokens init`, **Then** the CLI displays a welcome message with Quieto branding using Clack prompts.
2. **Given** the CLI has launched, **When** the init command runs, **Then** it detects whether a `quieto.config.json` file already exists in the current directory.
3. **Given** no config exists, **When** detection completes, **Then** the quick-start prompt flow begins (implemented in Story 1.2).
4. **Given** a config exists, **When** detection completes, **Then** the user is prompted whether to modify the existing system or start fresh.
5. **Given** any runtime error occurs during init, **When** the error is caught, **Then** a user-friendly error message is displayed via Clack's `cancel()` and the process exits with code 1.

## Tasks / Subtasks

- [ ] Task 1: Initialize TypeScript project structure (AC: #1)
  - [ ] 1.1: Configure `package.json` with correct name (`@quieto/tokens`), `type: "module"`, `bin` entry, and `exports` map
  - [ ] 1.2: Add TypeScript config (`tsconfig.json`) targeting ES2022+ with strict mode, ESM module resolution (`"module": "NodeNext"`)
  - [ ] 1.3: Add `tsup` as build tool with ESM output, `src/index.ts` entry, and `.d.ts` generation
  - [ ] 1.4: Create `src/` directory structure (see File Structure below)
  - [ ] 1.5: Add dev dependencies: `typescript`, `tsup`, `@types/node`
  - [ ] 1.6: Add runtime dependencies: `@clack/prompts` (^1.2.0)
  - [ ] 1.7: Add npm scripts: `build`, `dev` (tsup --watch), `type-check` (tsc --noEmit)
  - [ ] 1.8: Add `dist/` to `.gitignore`
- [ ] Task 2: Implement CLI entry point and command routing (AC: #1)
  - [ ] 2.1: Create `src/cli.ts` as the bin entry point with shebang (`#!/usr/bin/env node`)
  - [ ] 2.2: Parse `process.argv` for the subcommand (initially only `init`); display help/usage if no subcommand or `--help`
  - [ ] 2.3: Route `init` subcommand to `src/commands/init.ts`
- [ ] Task 3: Implement the `init` command with Clack welcome flow (AC: #1, #2, #3, #4)
  - [ ] 3.1: Display Clack `intro()` with Quieto branding message
  - [ ] 3.2: Check `process.cwd()` for existing `quieto.config.json`
  - [ ] 3.3: If config exists → Clack `select()` prompt: "Modify existing system" or "Start fresh"
  - [ ] 3.4: If no config → log intent to start quick-start flow (stub for Story 1.2)
  - [ ] 3.5: Display Clack `outro()` on completion
- [ ] Task 4: Implement error handling (AC: #5)
  - [ ] 4.1: Wrap command execution in try/catch; use Clack `cancel()` for user-facing errors
  - [ ] 4.2: Handle `Ctrl+C` / SIGINT gracefully (Clack's `isCancel()` check on every prompt response)
- [ ] Task 5: Verify the full flow (AC: #1-#5)
  - [ ] 5.1: `npm run build` succeeds; `node dist/cli.js init` displays the welcome flow
  - [ ] 5.2: Running in a directory without `quieto.config.json` proceeds to quick-start stub
  - [ ] 5.3: Running in a directory with `quieto.config.json` shows modify/fresh prompt

## Dev Notes

### Technical Stack

| Concern | Choice | Version |
|---------|--------|---------|
| Runtime | Node.js | >=18 (LTS) |
| Language | TypeScript | ^5.x (latest stable) |
| Build | tsup | latest (esbuild-based, ESM output) |
| CLI prompts | @clack/prompts | ^1.2.0 |
| Output engine | Style Dictionary | ^5.x (DTCG support) — not needed this story, listed for awareness |
| Color generation | @quieto/palettes | local/unpublished — not needed this story |

### Architecture Constraints

- **ESM-only:** The project uses `"type": "module"` in `package.json`. All imports must use ESM syntax. No CommonJS `require()`.
- **No framework coupling:** This CLI must not depend on React, Tailwind, or any frontend framework. It is a standalone Node CLI tool.
- **Clack is the only prompt library:** Do not introduce inquirer, prompts, or any other prompt library. Clack was chosen for its minimal, beautiful terminal UI that aligns with Quieto's design philosophy.
- **Command pattern:** Each subcommand lives in its own file under `src/commands/`. The CLI entry point (`src/cli.ts`) is a thin router that parses argv and dispatches.
- **Global prefix:** The token system uses `quieto` as its global prefix (e.g., `--quieto-color-blue-400`). This will matter in later stories but sets naming context now.

### Naming Convention Context

The CLI enforces a three-tier token nomenclature documented in `docs/qds/design-tokens-nomenclature.md`:
- **Primitive tokens** (Tier 1): `<category>.<subcategory>.<value>` — e.g., `color.blue.400`
- **Semantic tokens** (Tier 2): `<category>.<property>.<role>.<state>` — e.g., `color.background.default.hover`
- **Component tokens** (Tier 3): `<component>.<variant>.<property>.<state>` — e.g., `button.primary.color.background.hover`

CSS output adds the global prefix: `--quieto-color-blue-400`, `--quieto-semantic-color-background-default-hover`.

This story doesn't implement token generation, but the file/folder structure must anticipate it.

### Ecosystem Context

The Quieto ecosystem is:
1. `@quieto/engine` — color math calculations (exists, not yet published)
2. `@quieto/palettes` — accessible color ramp generation (exists, not yet published)
3. `@quieto/tokens` — **this CLI tool** (being built now)

The `@quieto/palettes` package is a dependency for Story 1.3 (color generation). For this story, it is **not needed** — do not install it yet.

### Project Philosophy

From the brainstorming session:
- The CLI should feel professional and beautiful — it "cultivates design appreciation"
- The progress narrative (real-time narration of what's being built) is a core UX feature across later stories
- The "preview moment" (seeing your token system before writing) is central to the experience
- The tool educates developers about design while generating tokens

The welcome message should reflect this philosophy: warm, confident, and design-conscious. Not corporate. Not overly playful.

### File Structure

```
src/
├── cli.ts                  # Bin entry point: shebang, argv parse, command dispatch
├── commands/
│   └── init.ts             # The `init` command: welcome → config detect → route
├── utils/
│   └── config.ts           # Config file detection and loading utilities
└── index.ts                # Package entry (re-exports for programmatic use)
```

**Rationale:** Keep the structure minimal but extensible. Future stories will add:
- `src/commands/add.ts`, `src/commands/component.ts`, etc.
- `src/generators/` for token generation logic (Story 1.3+)
- `src/mappers/` for semantic auto-mapping (Story 1.5)
- `src/output/` for Style Dictionary integration (Story 1.8)

### Config File Format

The config file is `quieto.config.json` in the project root. For this story, only detection matters — not the full schema. The schema will evolve across Stories 1.2–1.9. Minimal expected shape for detection:

```json
{
  "version": "1.0.0",
  "generated": "2026-04-16T00:00:00Z"
}
```

### What NOT to Build

- Do NOT implement the quick-start prompt flow (Story 1.2)
- Do NOT implement any token generation (Stories 1.3–1.6)
- Do NOT implement preview/override UI (Story 1.7)
- Do NOT implement file output (Story 1.8)
- Do NOT install `@quieto/palettes` or `style-dictionary` yet
- Do NOT add a test framework yet — testing patterns will be established once there is meaningful logic to test (Story 1.2+)

### package.json Configuration

The existing `package.json` needs significant changes. Key fields to set:

```json
{
  "name": "@quieto/tokens",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "quieto-tokens": "./dist/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "engines": {
    "node": ">=18"
  }
}
```

**Important:** The existing dependencies (`@notionhq/client`, `dotenv`, `yaml`) and scripts (`notion:init`, `notion:sync`) are for project tooling (Notion sync), not for the CLI product. Keep them for now but they are separate from the CLI's dependency tree. The `scripts/sync-to-notion.mjs` file is project infrastructure.

### tsup Configuration

**Recommended approach:** Place the shebang directly in `src/cli.ts` as the first line and do NOT use tsup's `banner` option (which would apply the shebang to all entry points including `index.ts`, breaking library usage).

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node18",
  splitting: false,
  sourcemap: true,
});
```

```typescript
// src/cli.ts (first line)
#!/usr/bin/env node
```

After building, ensure `dist/cli.js` is executable: `chmod +x dist/cli.js` (add as a `postbuild` script or verify tsup handles it).

### Project Structure Notes

- The current repo root has `docs/`, `scripts/`, `node_modules/`, and `.env` — these are project tooling, not part of the CLI product
- The CLI source code goes in `src/` (does not exist yet — create it)
- Build output goes to `dist/` (add to `.gitignore`)
- Token output (in later stories) goes to user's project directory, not this repo's output
- No `tokens/` directory exists yet in this repo — that's fine, this story doesn't need it

### References

- [Source: docs/planning/epics.md#Story 1.1] — Acceptance criteria and story statement
- [Source: docs/qds/design-tokens-nomenclature.md] — Three-tier naming algorithm, token anatomy
- [Source: docs/oss-tokens-system-planning.md] — Repository layout, architecture decisions
- [Source: docs/brainstorming/brainstorming-session-2026-04-16-1200.md] — CLI philosophy, DX priorities, technical stack decisions
- [Source: @clack/prompts v1.2.0] — intro(), outro(), select(), cancel(), isCancel() APIs
- [Source: tsup] — ESM build configuration for TypeScript CLI projects

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
