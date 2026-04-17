---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['docs/brainstorming/brainstorming-session-2026-04-16-1200.md', 'docs/qds/design-tokens-nomenclature.md', 'docs/oss-tokens-system-planning.md']
---

# Quieto Tokens CLI - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the Quieto Tokens CLI, decomposing the requirements from the brainstorming session and design token nomenclature into implementable stories. The tool is an open source CLI that walks solo developers through creating a complete design token system and outputs platform-specific artifacts.

## Requirements Inventory

### Functional Requirements

- FR1: CLI `init` command with quick-start mode asking 3-4 questions (brand color hex, spacing base, type scale preference, light/dark themes)
- FR2: Color primitive token generation via `@quieto/palettes` integration
- FR3: Spacing primitive token generation via curated presets (4px/8px grid)
- FR4: Typography primitive token generation via curated presets (modular type scales)
- FR5: Auto-mapping from primitive tokens to semantic tokens with sensible defaults
- FR6: Override step allowing users to modify auto-mapped semantic assignments before writing
- FR7: Preview of complete generated token system before writing to disk
- FR8: Light/dark theme variant generation from a single yes/no question
- FR9: DTCG-aligned JSON source file output (`$type`/`$value` with cross-tier references)
- FR10: CSS custom property output via Style Dictionary v4
- FR11: `quieto.config` file generation alongside output (the re-runnable recipe)
- FR12: Progress narrative during generation (real-time narration of what's being built)
- FR13: Advanced step-by-step mode for each token category
- FR14: `quieto-tokens add` subcommand for incremental category addition (shadow, border, animation)
- FR15: `quieto-tokens component` for guided tier 3 (component token) generation
- FR16: Re-entrant editing -- load existing config, modify specific categories, preserve overrides
- FR17: `--dry-run` flag for preview without writing files
- FR18: `quieto-tokens inspect` for design system health reporting (token counts, orphans, references)
- FR19: JSON output format for Figma Variables / Tokens Studio
- FR20: iOS Swift output format
- FR21: Android output format (XML or Compose)
- FR22: Design system changelog generation on regeneration (markdown, parseable)
- FR23: `quieto-tokens migrate` for mapping hardcoded CSS values to generated tokens

### Non-Functional Requirements

- NFR1: Quick-start session completes in under 2 minutes
- NFR2: All generated color tokens must be WCAG AA accessible by default (enforced by `@quieto/palettes`)
- NFR3: No Tailwind or framework coupling -- platform-native output only
- NFR4: DTCG spec compliance for all token source files
- NFR5: Node/TypeScript implementation
- NFR6: Clack for terminal prompt UI
- NFR7: Style Dictionary v4 as the output transform engine
- NFR8: Token naming enforced by the three-tier nomenclature algorithm (global prefix, category, subcategory, property, role, state)

### Additional Requirements

- The Quieto ecosystem has three layers: `@quieto/engine` (color calculations) → `@quieto/palettes` (accessible ramp generation) → this CLI tool (token system generation)
- The CLI is architected to feed a future open source Design System MCP server
- The three-tier naming convention (primitive, semantic, component) is fully documented in `docs/qds/design-tokens-nomenclature.md` and must be enforced by the generator
- Style Dictionary v4 is accepted as a core dependency for output transforms and theming
- Clack is the chosen prompt library for terminal UI

### FR Coverage Map

- FR1: Epic 1 - Quick-start prompt flow
- FR2: Epic 1 - Color generation via @quieto/palettes
- FR3: Epic 1 - Spacing preset generation
- FR4: Epic 1 - Typography preset generation
- FR5: Epic 1 - Primitive-to-semantic auto-mapping
- FR6: Epic 1 - Override step for semantic assignments
- FR7: Epic 1 - Token preview before writing
- FR8: Epic 1 - Light/dark theme generation
- FR9: Epic 1 - DTCG JSON source output
- FR10: Epic 1 - CSS custom property output
- FR11: Epic 1 - quieto.config generation
- FR12: Epic 1 - Progress narrative
- FR13: Epic 2 - Advanced step-by-step mode
- FR14: Epic 2 - `add` subcommand
- FR15: Epic 2 - `component` subcommand
- FR16: Epic 3 - Re-entrant editing
- FR17: Epic 3 - `--dry-run` flag
- FR18: Epic 5 - `inspect` command
- FR19: Epic 4 - JSON/Figma output
- FR20: Epic 4 - iOS output
- FR21: Epic 4 - Android output
- FR22: Epic 3 - Design system changelog
- FR23: Epic 5 - `migrate` command

## Epic List

### Epic 1: Quick-Start Token Generation
A solo developer can run a single command, answer a few questions, and walk away with a complete, accessible design token system as CSS variables. This is the MVP.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12

### Epic 2: Advanced Token Authoring
A developer who outgrows quick-start can take full control, walking through each category step-by-step and authoring component-level tokens.
**FRs covered:** FR13, FR14, FR15

### Epic 3: Token System Evolution
A developer can modify, extend, and track their design system over time without starting over.
**FRs covered:** FR16, FR17, FR22

### Epic 4: Multi-Platform Output
A developer can output their token system to iOS, Android, and Figma/Tokens Studio alongside CSS.
**FRs covered:** FR19, FR20, FR21

### Epic 5: Design System Intelligence
A developer can analyze their token system's health and migrate existing hardcoded values to tokens.
**FRs covered:** FR18, FR23

---

## Epic 1: Quick-Start Token Generation

A solo developer can run a single command, answer a few questions, and walk away with a complete, accessible design token system as CSS variables. From zero to a working design token system in under 2 minutes.

### Story 1.1: CLI Scaffolding and Init Entry Point

As a **solo developer**,
I want to run `npx @quieto/tokens init` and be greeted with a clear, beautiful CLI interface,
So that I know I'm using a professional tool that will guide me through token creation.

**Acceptance Criteria:**

**Given** the user has Node.js installed
**When** they run `npx @quieto/tokens init`
**Then** the CLI displays a welcome message with the Quieto branding using Clack prompts
**And** the CLI detects whether a `quieto.config` file already exists in the current directory
**And** if no config exists, the quick-start prompt flow begins
**And** if a config exists, the user is asked whether to modify the existing system or start fresh

### Story 1.2: Quick-Start Prompt Flow

As a **solo developer**,
I want to answer a few simple questions about my design preferences,
So that the tool has enough information to generate my entire token system.

**Acceptance Criteria:**

**Given** the CLI has started the quick-start flow
**When** the user is prompted for their design preferences
**Then** they are asked for their primary brand color (hex value input with validation)
**And** they are asked to choose a spacing base (4px or 8px, with brief explanation of each)
**And** they are asked to choose a type scale (compact, balanced, or spacious, with preview of sizes)
**And** they are asked whether to generate light and dark themes (yes/no)
**And** all inputs are validated before proceeding
**And** the flow completes in under 30 seconds of user interaction

### Story 1.3: Color Primitive Token Generation

As a **solo developer**,
I want my brand color to be expanded into a complete, accessible color palette,
So that I have a full set of color primitives without needing to understand color theory.

**Acceptance Criteria:**

**Given** the user has provided a brand color hex value
**When** the color generation step runs
**Then** `@quieto/palettes` generates an accessible primary color ramp (full step scale)
**And** a neutral/gray ramp is generated for backgrounds, text, and borders
**And** all generated color steps are WCAG AA compliant against their intended usage context
**And** the progress narrative displays each ramp being generated with step counts
**And** color tokens follow the primitive naming convention: `color.<hue>.<step>`

### Story 1.4: Spacing and Typography Primitive Token Generation

As a **solo developer**,
I want spacing and typography scales generated from my preferences,
So that I have consistent, harmonious values for layout and text without manual calculation.

**Acceptance Criteria:**

**Given** the user has selected a spacing base and type scale preference
**When** the primitive generation step runs
**Then** a spacing ramp is generated from the selected base (e.g., 4px base produces 4, 8, 12, 16, 24, 32, 48, 64, 96)
**And** a type scale is generated matching the selected preference (compact, balanced, or spacious) with 5-7 size steps
**And** font weight primitives are generated (regular, medium, semibold, bold at minimum)
**And** the progress narrative describes each scale being built
**And** spacing tokens follow `spacing.<value>` naming convention
**And** typography tokens follow `typography.<subcategory>.<value>` naming convention

### Story 1.5: Primitive-to-Semantic Auto-Mapping

As a **solo developer**,
I want my primitive tokens automatically assigned to meaningful semantic roles,
So that I get usable tokens like `color.background.primary` without manually wiring anything.

**Acceptance Criteria:**

**Given** all primitive tokens have been generated (color, spacing, typography)
**When** the semantic auto-mapping step runs
**Then** color primitives are mapped to semantic color tokens (background, content, border) across roles (default, primary, secondary, danger, warning, success, info)
**And** spacing primitives are mapped to semantic spacing tokens (xs, sm, md, lg, xl, 2xl)
**And** typography primitives are mapped to semantic type tokens across roles (headline, body, label, meta)
**And** semantic tokens reference their primitive sources using DTCG reference syntax
**And** the progress narrative reports the number of semantic tokens generated per category

### Story 1.6: Theme Variant Generation

As a **solo developer**,
I want light and dark theme variants generated automatically from my palette,
So that I support both appearances without designing two separate color systems.

**Acceptance Criteria:**

**Given** the user selected "yes" to light/dark theme generation
**When** the theme generation step runs
**Then** a light theme is generated with appropriate semantic mappings (light backgrounds, dark text)
**And** a dark theme is generated by inverting the semantic mappings (dark backgrounds, light text)
**And** both themes reference the same primitive palette -- only the semantic mappings differ
**And** if the user selected "no" to themes, only a single default theme is generated
**And** theme structure follows Style Dictionary's platform/theme conventions

### Story 1.7: Preview, Override, and Confirmation

As a **solo developer**,
I want to see my complete token system before any files are written,
So that I can verify the output looks right and override any auto-mapped values I disagree with.

**Acceptance Criteria:**

**Given** all tokens (primitives, semantics, themes) have been generated in memory
**When** the preview step is displayed
**Then** the CLI shows a summary of all generated tokens organized by tier and category
**And** color tokens display ANSI color swatches in the terminal where supported
**And** color tokens show inline WCAG contrast ratio annotations
**And** the user can select any semantic mapping to override its primitive assignment
**And** the user can accept all defaults by pressing enter
**And** overrides are recorded in the config for future re-generation
**And** a token count summary is displayed (e.g., "147 tokens: 43 primitive, 78 semantic, 2 themes")

### Story 1.8: DTCG JSON and CSS Output via Style Dictionary

As a **solo developer**,
I want my token system written as DTCG-aligned JSON source files and CSS custom properties,
So that I have a standards-compliant source of truth and immediately usable CSS variables.

**Acceptance Criteria:**

**Given** the user has confirmed the token preview
**When** the output step runs
**Then** DTCG JSON source files are written to `tokens/primitive/` and `tokens/semantic/` directories
**And** JSON files use `$type`, `$value`, and `$description` per DTCG spec
**And** semantic tokens use DTCG reference syntax to point to primitives (e.g., `"{color.blue.500}"`)
**And** Style Dictionary v4 processes the source files and outputs CSS custom properties to a `build/` directory
**And** CSS variables follow the naming convention with the user's global prefix
**And** theme variants are output as separate CSS files or scoped under class selectors
**And** the progress narrative confirms each file written with its path

### Story 1.9: Config File Generation

As a **solo developer**,
I want my quick-start choices saved to a config file,
So that I can re-run the tool later to modify my token system without starting over.

**Acceptance Criteria:**

**Given** output files have been successfully written
**When** the config generation step runs
**Then** a `quieto.config.json` (or `.yaml`) file is written to the project root
**And** the config contains all quick-start inputs (brand color, spacing base, type scale, theme choice)
**And** the config contains any semantic overrides the user made in the preview step
**And** the config contains metadata (tool version, generation timestamp)
**And** a final success message is displayed with the output directory path and a brief "what's next" guide
**And** the progress narrative confirms "Config saved -- you can re-run to modify your system anytime"

### Story 1.10: Color Ramp Corrections

_Post-retrospective defect fix against Stories 1.3 and 2.1._ The shipped color generator has two defects: (1) the ramp direction is inverted — `color.<hue>.50` is currently the darkest step instead of the lightest, because `@quieto/engine`'s dark→light step emission was paired with label index 0; and (2) the ramp contains 11 steps (50–950) instead of the industry-standard 10 (50–900). Epic 1 is temporarily reopened from `done` → `in-progress` for this correction; `epic-1-retrospective` stays `done`.

As a **solo developer using Quieto-generated color tokens**,
I want palette steps to follow the industry-standard labeling (50 = lightest, 900 = darkest) with exactly 10 steps per hue,
So that my generated tokens match Tailwind / Radix / Material conventions and integrate predictably with existing design systems.

**Acceptance Criteria:**

**Given** any brand hex **When** `generatePrimaryRamp`, `generateNeutralRamp`, or `generateCustomRamp` runs **Then** the returned ramp has exactly 10 steps with labels `[50, 100, 200, 300, 400, 500, 600, 700, 800, 900]` in that order
**And** `steps[0]` (label `50`) is the lightest (highest OKLCH L) and `steps[9]` (label `900`) is the darkest (lowest OKLCH L)
**And** OKLCH L is monotonically non-increasing from index 0 → 9
**And** no `color.<hue>.950` tokens appear in any emitted artifact (DTCG JSON, CSS, config, preview)
**And** progress narrative step counts read "10 steps"
**And** `PRIMARY_STEP_INVERSION` / `NEUTRAL_STEP_INVERSION` cover exactly the 10 valid steps with no `950` keys
**And** the entire test suite passes with assertions updated from the old contract
**And** Story 1.3 / Story 1.6 docs are updated to reflect the corrected step count and direction
**And** the committed fixture artifacts (`tokens/primitive/color.json`, `tokens/semantic/default/color.json`, `build/tokens.css`) are regenerated (not hand-edited) from a fresh `init` run

---

## Epic 2: Advanced Token Authoring

A developer who outgrows quick-start can take full control, walking through each category step-by-step and authoring component-level tokens.

### Story 2.1: Advanced Mode for Core Categories

As a **solo developer**,
I want to re-enter my token system in an advanced step-by-step mode,
So that I can fine-tune each token category with more granular control than quick-start provides.

**Acceptance Criteria:**

**Given** a `quieto.config` file exists in the project (generated by Epic 1)
**When** the user runs `quieto-tokens init --advanced` or selects advanced mode at the init prompt
**Then** the CLI walks through each core category (color, spacing, typography) one at a time
**And** the color step allows adding additional hue ramps beyond the primary (e.g., accent, secondary, error, warning, success)
**And** the spacing step allows customizing individual scale values rather than picking a preset
**And** the typography step allows specifying font families, individual sizes, weights, line heights, and letter spacing
**And** each category step shows a preview of changes before applying
**And** the user can skip categories they don't want to modify
**And** the config file is updated with all advanced choices

### Story 2.2: Add Subcommand for New Token Categories

As a **solo developer**,
I want to add new token categories to my existing system incrementally,
So that I can expand my design system over time without regenerating what I already have.

**Acceptance Criteria:**

**Given** a `quieto.config` file and existing token output exist
**When** the user runs `quieto-tokens add shadow` (or `border`, `animation`)
**Then** the CLI loads the existing token system context (available primitives and semantics)
**And** walks through generation prompts specific to that category (e.g., shadow: elevation levels, blur, spread, color)
**And** generates primitive tokens for the new category
**And** generates corresponding semantic tokens that reference the new primitives
**And** integrates the new tokens into the existing DTCG JSON source files (not overwriting existing tokens)
**And** rebuilds the CSS output via Style Dictionary to include the new tokens
**And** updates the `quieto.config` with the new category configuration
**And** if the user runs `quieto-tokens add` without a category name, a list of available categories is shown

### Story 2.3: Guided Component Token Generation

As a **solo developer building a component library**,
I want to generate component-level tokens that reference my semantic tokens,
So that I have a complete three-tier token system with component-specific design decisions.

**Acceptance Criteria:**

**Given** the user has a token system with primitives and semantics (from Epic 1 or Story 2.1)
**When** the user runs `quieto-tokens component button` (or any component name)
**Then** the CLI presents available semantic tokens as options for each component property
**And** walks through standard component properties: color-background, color-content, color-border, spacing (padding), border-radius, typography
**And** for each property, prompts for state variants (default, hover, active, focus, disabled) as applicable
**And** generates component tokens following the naming convention: `<component>.<variant>.<property>.<state>`
**And** component tokens reference semantic tokens using DTCG reference syntax
**And** the generated tokens are written to `tokens/component/` directory
**And** CSS output is rebuilt to include the new component tokens
**And** the user can define custom variants beyond default (e.g., `button primary`, `button secondary`)

---

## Epic 3: Token System Evolution

A developer can modify, extend, and track their design system over time without starting over.

### Story 3.1: Re-Entrant Editing

As a **solo developer whose brand has evolved**,
I want to modify specific parts of my token system without regenerating everything,
So that I can update my brand color or spacing scale while preserving the rest of my decisions.

**Acceptance Criteria:**

**Given** a `quieto.config` file and existing token output exist
**When** the user runs `quieto-tokens update` (or `quieto-tokens init` detects an existing config)
**Then** the CLI loads the existing config and displays the current system summary
**And** the user can select which category to modify (color, spacing, typography, or themes)
**And** only the selected category's prompts are presented (pre-filled with current values)
**And** after the user makes changes, the auto-mapping step re-runs for affected semantic tokens only
**And** any manual overrides from previous sessions are preserved unless they conflict with the new values
**And** conflicting overrides are flagged and the user is prompted to resolve them
**And** the config file is updated with the new values

### Story 3.2: Token Diff Display

As a **solo developer making changes to my token system**,
I want to see exactly what will change before any files are written,
So that I can understand the impact of my modifications and catch unintended consequences.

**Acceptance Criteria:**

**Given** the user has made modifications via `quieto-tokens update`
**When** the preview step is displayed before writing
**Then** the CLI shows a diff of changed tokens grouped by tier (primitives changed, semantics affected)
**And** added tokens are highlighted distinctly from modified tokens and removed tokens
**And** the diff traces cascading changes (e.g., "Changing `color.blue.500` affects 12 semantic tokens")
**And** the user can accept the changes, cancel without writing, or go back to modify further
**And** if there are no changes detected, the CLI reports "No changes to apply" and exits cleanly

### Story 3.3: Dry Run Mode

As a **solo developer evaluating changes**,
I want to run the CLI in dry-run mode to see what would be generated without writing anything,
So that I can evaluate the output before committing to it.

**Acceptance Criteria:**

**Given** the user wants to preview generation without side effects
**When** the user runs any command with the `--dry-run` flag (e.g., `quieto-tokens init --dry-run` or `quieto-tokens update --dry-run`)
**Then** the full generation pipeline runs including prompts, token generation, and auto-mapping
**And** the preview and token count summary are displayed as normal
**And** no files are written to disk (no tokens/, no build/, no config changes)
**And** the CLI explicitly confirms "Dry run complete -- no files were written"
**And** the `--dry-run` flag works with all commands that produce output (`init`, `update`, `add`, `component`)

### Story 3.4: Design System Changelog

As a **solo developer managing a living design system**,
I want a changelog generated automatically when I modify my tokens,
So that I have a record of what changed and why, useful for my own reference and for communicating changes to collaborators.

**Acceptance Criteria:**

**Given** the user has made modifications and confirmed the write step
**When** the output files are written
**Then** a `TOKENS_CHANGELOG.md` file is created (or appended to) in the token output root
**And** each entry includes a timestamp, the tool version, and a human-readable summary
**And** the summary lists: what categories changed, which specific tokens were added/modified/removed, and the config delta that triggered the change
**And** cascading effects are documented (e.g., "Updated primary color: 12 semantic tokens remapped")
**And** the changelog is structured markdown that is also parseable programmatically
**And** the first generation (from `init`) creates the initial changelog entry: "Initial token system generated"
**And** the changelog is ordered newest-first

---

## Epic 4: Multi-Platform Output

A developer can output their token system to iOS, Android, and Figma/Tokens Studio alongside CSS.

### Story 4.1: JSON Output for Figma Variables and Tokens Studio

As a **solo developer who works with a designer (or designs in Figma themselves)**,
I want my token system exported as JSON compatible with Figma Variables and Tokens Studio,
So that my design tool and my codebase share the same source of truth.

**Acceptance Criteria:**

**Given** the user has a generated token system (from Epic 1 or later)
**When** the user runs `quieto-tokens init` or `quieto-tokens update` and selects JSON/Figma as an output format
**Then** a Figma-compatible JSON file is generated alongside the existing CSS output
**And** the JSON follows Tokens Studio format conventions (nested object structure with `$value` and `$type`)
**And** token names use `/` separator for Figma Variable groups (e.g., `color/blue/500`)
**And** theme variants are structured as separate Figma Variable collections (light, dark)
**And** cross-tier references are preserved in the JSON output
**And** the output platform can be enabled/disabled in `quieto.config` under an `outputs` array
**And** Style Dictionary handles the format transform via a custom or built-in Figma formatter

### Story 4.2: iOS Swift Output

As a **solo developer building an iOS app**,
I want my token system exported as Swift constants,
So that I can use the same design decisions in my iOS codebase without manual translation.

**Acceptance Criteria:**

**Given** the user has a generated token system
**When** the user selects iOS as an output format
**Then** Style Dictionary generates Swift files with token values as static constants
**And** color tokens are output as `UIColor` / `Color` (SwiftUI) extensions
**And** spacing tokens are output as `CGFloat` constants
**And** typography tokens are output as font configuration structs or constants
**And** theme variants are supported via Swift asset catalogs or conditional constants
**And** the generated file structure is organized by token category
**And** the output directory is configurable in `quieto.config` (defaults to `build/ios/`)

### Story 4.3: Android Output

As a **solo developer building an Android app**,
I want my token system exported as Android-native resource formats,
So that I can use the same design decisions in my Android codebase without manual translation.

**Acceptance Criteria:**

**Given** the user has a generated token system
**When** the user selects Android as an output format
**Then** Style Dictionary generates Android resource XML files (or Jetpack Compose constants)
**And** color tokens are output as `<color>` resources in `colors.xml` (or Compose `Color` constants)
**And** spacing tokens are output as `<dimen>` resources in `dimens.xml` (or Compose `Dp` constants)
**And** typography tokens are output as appropriate Android type resources
**And** theme variants are supported via Android resource qualifiers (`values/` vs `values-night/`) or Compose theming
**And** the output format (XML resources vs Compose) is configurable in `quieto.config`
**And** the output directory is configurable (defaults to `build/android/`)

---

## Epic 5: Design System Intelligence

A developer can analyze their token system's health and migrate existing hardcoded values to tokens.

### Story 5.1: Inspect Command for Design System Health

As a **solo developer maintaining a growing token system**,
I want to analyze my token system's structure and health,
So that I can identify issues like orphaned tokens, broken references, or imbalanced coverage before they cause problems.

**Acceptance Criteria:**

**Given** the user has a generated token system with DTCG JSON source files
**When** the user runs `quieto-tokens inspect`
**Then** the CLI loads and parses all token files across all tiers
**And** displays a summary report including: total token count by tier, token count by category, and theme count
**And** identifies orphaned primitive tokens (primitives not referenced by any semantic token)
**And** identifies broken references (semantic tokens pointing to non-existent primitives)
**And** validates all token names against the naming convention algorithm
**And** for color tokens, reports contrast ratios between paired text/background semantic tokens
**And** flags any contrast pairs that fail WCAG AA
**And** the report is displayed in the terminal with clear pass/fail indicators
**And** the user can optionally output the report to a file with `--output report.md`

### Story 5.2: Migrate Command for Token Adoption

As a **solo developer with an existing codebase**,
I want to scan my CSS files and find hardcoded values that match my generated tokens,
So that I can systematically replace raw values with token references and actually adopt my design system.

**Acceptance Criteria:**

**Given** the user has a generated token system and an existing codebase with CSS files
**When** the user runs `quieto-tokens migrate --scan ./src` (or a specified directory)
**Then** the CLI scans all CSS, SCSS, and style files in the target directory
**And** matches hardcoded color hex values against primitive color tokens
**And** matches hardcoded pixel values against spacing and typography token values
**And** displays a report of matches: file path, line number, hardcoded value, and suggested token replacement
**And** groups matches by confidence level (exact match vs approximate match)
**And** displays a summary of total replaceable values found and estimated adoption coverage
**And** the user can optionally run `quieto-tokens migrate --apply ./src` to perform the replacements automatically
**And** automatic replacements create a backup of modified files or require git clean state
**And** the migration report can be output to a file with `--output migration-report.md`
