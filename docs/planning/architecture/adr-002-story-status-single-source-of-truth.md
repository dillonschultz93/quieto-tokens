# ADR-002: Story Status Single Source of Truth

- **Status:** Accepted
- **Date:** 2026-04-16
- **Deciders:** Dillon (project lead)
- **Related action item:** Epic 1 retrospective, **A10**
- **Triggered by:** Status drift between `sprint-status.yaml` and story files (Story 1.5 stale `review` vs `done`; `epic-1: in-progress` vs all-stories-done)

---

## Context

The project tracks story state in **two places**:

1. **`docs/planning/sprint-status.yaml`** — a flat YAML tracker of every story and epic's status, plus epic-level rollups (e.g., `epic-1: in-progress` → `done`).
2. **`docs/planning/stories/<id>.md`** — each story markdown file has a `Status: <value>` line near the top that drives the BMAD workflow skills (`bmad-dev-story` reads/writes it during implementation; `bmad-code-review` updates it on review close).

During Epic 1, two drift incidents occurred:

- **Story 1.5** stayed at `Status: review` in the story file for days after `sprint-status.yaml` had moved it to `done`.
- **`epic-1`** stayed at `in-progress` in `sprint-status.yaml` after all nine of its stories had been marked `done`.

Both were cosmetic — downstream work didn't break — but they indicate a process that will get worse as more epics land.

---

## Decision Drivers

1. **BMAD skills depend on per-story `Status:` headers.** Removing them would require patching vendored/local skill workflows, which is invasive and risks downstream brittleness.
2. **`sprint-status.yaml` is the only place that holds epic-level state.** Individual story files can't represent "all stories in Epic N are done → Epic N is done" on their own.
3. **We want no drift, ever.** The cost of drift is low per instance but scales badly: more epics → more chances, and stale status confuses retros and sprint planning.
4. **The fix should be mechanical, not a discipline ask.** Relying on "remember to update both places" has already failed once.
5. **Changes should be reversible.** We may revisit and move to full generation (Option 2 below) later; this decision shouldn't lock that out.

---

## Options Considered

### Option 1 — Single SOT: `sprint-status.yaml`; remove `Status:` from story files

Story files become pure specs. `sprint-status.yaml` becomes the only place state lives.

- **Pros:** True single source of truth. No drift possible.
- **Cons:**
  - Breaks BMAD skills (`bmad-dev-story`, `bmad-code-review`, `bmad-create-story`) that read/write the `Status:` header.
  - Patching skills that live under `.claude/skills/` is an investment and couples us to a skill-version fork.
  - Loses at-a-glance status visibility when reading a story file.

### Option 2 — Single SOT: story files; generate `sprint-status.yaml`

Each story's `Status:` header is authoritative. A small script reads all story files and regenerates `sprint-status.yaml` (including epic-level rollups).

- **Pros:**
  - Truly single-sourced; the YAML becomes a derived artifact.
  - BMAD skills keep working unchanged.
- **Cons:**
  - Epic-level status (`epic-1: done`) becomes a computation, not a declaration — you'd have to run the script before asking "is Epic 1 done?". Solvable but friction-heavy.
  - Non-story YAML fields (the top-level `generated`, `last_updated`, project metadata) must be preserved by the generator, adding complexity.
  - Requires discipline: regenerate before commit. Same class of problem this ADR is trying to solve.

### Option 3 — Both sources, automated sync check

Keep both sources. Add a tiny validator script that reads both and fails loudly if they disagree. Wire it into:

- an explicit `npm run` script for manual + CI use
- optionally a pre-commit hook (future)
- BMAD workflow close steps can call it to self-verify

- **Pros:**
  - Zero disruption to existing workflow or skills.
  - Drift becomes a detectable, fixable error — not silent.
  - Cheap to build (single-file script, ~100 lines).
  - Reversible: can later migrate to Option 1 or 2 without throwing work away.
- **Cons:**
  - Two writes are still required on every status transition.
  - Detection is only as good as how often the validator runs. Needs discipline or CI wiring to matter.

---

## Decision

**Option 3 — keep both sources, add an automated validator.**

Specifics:

1. **`sprint-status.yaml` remains canonical** for epic-level rollups and cross-story views. The per-story `Status:` header in each markdown file must match its entry in the YAML.
2. A new script, `scripts/validate-sprint-status.mjs`, reads both and exits non-zero with a clear diff if they disagree.
3. An npm script, `npm run validate:sprint`, wraps it for ergonomics.
4. The validator is wired opportunistically for now:
   - Run manually before commits that touch status (codified in this ADR and a `CONTRIBUTING`-style note where appropriate).
   - Wire into CI (GitHub Actions) in a future change.
   - Wire into `bmad-dev-story` / `bmad-code-review` close steps in a future change.
5. **Epic-level status** (`epic-<N>: done`) is **only** tracked in `sprint-status.yaml`. The validator rolls up story statuses and flags mismatches: if every story under an epic is `done`, the epic must also be `done`.
6. Re-evaluate in Epic 3: if drift still happens despite automation, escalate to Option 2 (generate the YAML).

---

## Consequences

### Positive

- **Drift becomes loud, not silent.** The next time it happens, `npm run validate:sprint` catches it.
- **Zero change to BMAD skill workflows.** Existing `bmad-dev-story`, `bmad-code-review`, `bmad-create-story` flows are unaffected.
- **Minimal surface area.** One script file, one npm script, one ADR. No schema changes, no skill patches.
- **Future-compatible.** Can migrate to Option 2 (generation) without changing story file format.

### Negative / accepted trade-offs

- **Still two writes per transition.** `bmad-dev-story` and `bmad-code-review` already perform both writes; the validator catches drift, it doesn't eliminate it.
- **Validator must be run to matter.** Until it's wired to CI or a hook, enforcement depends on the developer running it. Mitigation: call it out in story completion checklists and add CI wiring as a follow-up.

### Neutral

- **Story files keep their at-a-glance `Status:` header.** Useful when reading a single story file in isolation.
- **Epic-level status stays where it is.** No restructuring of `sprint-status.yaml`.

---

## Implementation

Delivered as part of this ADR commit:

- `scripts/validate-sprint-status.mjs` — the validator, modeled on the existing `scripts/sync-to-notion.mjs` style (plain `.mjs`, ESM, uses the already-vendored `yaml` dependency).
- `package.json` gets a new script: `"validate:sprint": "node scripts/validate-sprint-status.mjs"`.

**What the validator checks:**

1. Every story entry in `sprint-status.yaml` has a matching file in `docs/planning/stories/`.
2. Every story file in `docs/planning/stories/` has an entry in `sprint-status.yaml`.
3. For each story, the `Status:` line in the markdown file matches the YAML value.
4. For each `epic-<N>` rollup: if all stories under that epic are `done`, the epic must also be `done`; otherwise it must be `in-progress` (if any story is past `backlog`) or `backlog` (if none are).

**Exit codes:**

- `0` — all checks pass.
- `1` — at least one mismatch; a formatted diff is printed.

---

## Follow-ups

- **CI wiring** — add `npm run validate:sprint` to a GitHub Actions job that runs on pushes to any branch. Not in this ADR; tracked as a future task.
- **Pre-commit hook** — optional; consider after observing validator hit rate in Epic 2.
- **Skill integration** — update `bmad-dev-story` and `bmad-code-review` local skill files to invoke the validator on close. Not in this ADR.
- **Epic 3 review** — if drift recurs with validator in place, escalate to Option 2 (generate YAML from story files).

---

## References

- Epic 1 retro action item **A10** — `_bmad-output/implementation-artifacts/epic-1-retro-2026-04-16.md`
- Drift instances: Story 1.5 `Status: review` (fixed 2026-04-16); `epic-1: in-progress` (fixed 2026-04-16)
- Existing tracker: `docs/planning/sprint-status.yaml`
- Story files: `docs/planning/stories/*.md`
- Related script style: `scripts/sync-to-notion.mjs`
