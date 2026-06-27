# Contributing

Thanks for your interest in contributing to Quieto Skills! This guide covers how to get set up and submit changes.

## Prerequisites

- Node.js >= 18
- [Claude Code](https://claude.ai/code) for testing skills
- [`@quieto/tokens`](https://www.npmjs.com/package/@quieto/tokens) installed in a test project

## Getting Started

1. Fork and clone the repo
2. Create a branch for your change

```bash
git checkout -b my-change
```

## Project Structure

Each skill is a directory at the project root named `design-token-*` containing a `SKILL.md` file. The `bin/cli.js` script handles installing skills into a user's project via `npx @quieto/skills install`.

```
design-token-<name>/
  SKILL.md
```

## Adding a New Skill

1. Create a new directory following the `design-token-<name>` naming convention
2. Add a `SKILL.md` that defines the skill's behavior, including the slash command, description, and workflow steps
3. Test the skill in a project with `@quieto/tokens` installed by copying it into `.claude/skills/` and invoking it in Claude Code

## Testing Changes

There is no automated test suite. To verify your changes:

1. Copy the modified skill into a test project's `.claude/skills/` directory
2. Open Claude Code in the test project
3. Invoke the skill via its slash command and walk through the workflow
4. Confirm the skill produces correct output and handles edge cases

You can also test the installer:

```bash
node bin/cli.js install /path/to/test/project
```

## Submitting a Pull Request

1. Keep PRs focused on a single skill or change
2. Describe what the skill does and how you tested it
3. Make sure your `SKILL.md` follows the conventions used by existing skills

## Code of Conduct

Be kind and constructive. We're all here to make design token workflows better.
