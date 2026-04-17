#!/usr/bin/env node
/**
 * Validate sprint-status.yaml against docs/planning/stories/*.md.
 *
 * Decision record: docs/planning/architecture/adr-002-story-status-single-source-of-truth.md
 *
 * Exit 0 when everything agrees; exit 1 with a formatted diff when anything
 * drifts. Safe to run locally or in CI.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const STORIES_DIR = resolve(ROOT, "docs/planning/stories");
const SPRINT_STATUS_PATH = resolve(ROOT, "docs/planning/sprint-status.yaml");

const VALID_STORY_STATUSES = new Set([
  "backlog",
  "ready-for-dev",
  "in-progress",
  "review",
  "done",
]);

const VALID_EPIC_STATUSES = new Set(["backlog", "in-progress", "done"]);
const VALID_RETRO_STATUSES = new Set(["optional", "done"]);

function readSprintStatus() {
  if (!existsSync(SPRINT_STATUS_PATH)) {
    fail(`sprint-status.yaml not found at ${SPRINT_STATUS_PATH}`);
  }
  const raw = readFileSync(SPRINT_STATUS_PATH, "utf-8");
  const doc = parseYaml(raw);
  if (!doc || typeof doc !== "object" || !doc.development_status) {
    fail("sprint-status.yaml is missing a top-level `development_status:` map");
  }
  return doc.development_status;
}

function readStoryStatuses() {
  if (!existsSync(STORIES_DIR)) {
    fail(`stories directory not found at ${STORIES_DIR}`);
  }
  const files = readdirSync(STORIES_DIR).filter((f) => f.endsWith(".md"));
  const statuses = new Map();
  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const raw = readFileSync(resolve(STORIES_DIR, file), "utf-8");
    const match = raw.match(/^Status:\s*(\S+)\s*$/m);
    if (!match) {
      statuses.set(slug, { status: null, reason: "missing Status: line" });
      continue;
    }
    statuses.set(slug, { status: match[1], reason: null });
  }
  return statuses;
}

function classifyKey(key) {
  if (key === "development_status") return "skip";
  if (/^epic-\d+$/.test(key)) return "epic";
  if (/^epic-\d+-retrospective$/.test(key)) return "retro";
  return "story";
}

function epicOfStory(slug) {
  const m = slug.match(/^(\d+)-/);
  return m ? `epic-${m[1]}` : null;
}

function rollupEpicStatus(storyStatuses) {
  if (storyStatuses.length === 0) return "backlog";
  if (storyStatuses.every((s) => s === "done")) return "done";
  if (storyStatuses.every((s) => s === "backlog")) return "backlog";
  return "in-progress";
}

function fail(msg) {
  console.error(`validate-sprint-status: ${msg}`);
  process.exit(1);
}

function main() {
  const yamlStatus = readSprintStatus();
  const fileStatuses = readStoryStatuses();

  const problems = [];

  // Group story keys by epic for rollup checks.
  const storiesByEpic = new Map();
  const yamlStoryKeys = new Set();
  const yamlEpicKeys = new Set();

  for (const [key, value] of Object.entries(yamlStatus)) {
    const kind = classifyKey(key);
    if (kind === "story") {
      yamlStoryKeys.add(key);
      if (!VALID_STORY_STATUSES.has(value)) {
        problems.push(
          `  [yaml] story \`${key}\` has invalid status \`${value}\` (expected one of: ${[...VALID_STORY_STATUSES].join(", ")})`,
        );
      }
      const epic = epicOfStory(key);
      if (epic) {
        if (!storiesByEpic.has(epic)) storiesByEpic.set(epic, []);
        storiesByEpic.get(epic).push({ key, status: value });
      }
    } else if (kind === "epic") {
      yamlEpicKeys.add(key);
      if (!VALID_EPIC_STATUSES.has(value)) {
        problems.push(
          `  [yaml] epic \`${key}\` has invalid status \`${value}\` (expected one of: ${[...VALID_EPIC_STATUSES].join(", ")})`,
        );
      }
    } else if (kind === "retro") {
      if (!VALID_RETRO_STATUSES.has(value)) {
        problems.push(
          `  [yaml] retrospective \`${key}\` has invalid status \`${value}\` (expected one of: ${[...VALID_RETRO_STATUSES].join(", ")})`,
        );
      }
    }
  }

  // Check 1: every YAML story past `backlog` has a matching file + headers match.
  // Per sprint-status.yaml's own conventions, `backlog` means the story only
  // exists in the epic file yet — the markdown file is created by
  // `bmad-create-story` when work is about to begin.
  for (const key of yamlStoryKeys) {
    const yamlValue = yamlStatus[key];
    const fileEntry = fileStatuses.get(key);
    if (!fileEntry) {
      if (yamlValue !== "backlog") {
        problems.push(
          `  [missing file] yaml has \`${key}\` = \`${yamlValue}\` but no matching docs/planning/stories/${key}.md`,
        );
      }
      continue;
    }
    if (fileEntry.status === null) {
      problems.push(
        `  [missing header] ${key}.md has no \`Status:\` line (yaml says \`${yamlValue}\`)`,
      );
      continue;
    }
    if (fileEntry.status !== yamlValue) {
      problems.push(
        `  [drift] ${key}: file=\`${fileEntry.status}\` yaml=\`${yamlValue}\``,
      );
    }
  }

  // Check 2: every file has a YAML entry.
  for (const slug of fileStatuses.keys()) {
    if (!yamlStoryKeys.has(slug)) {
      problems.push(
        `  [missing yaml] docs/planning/stories/${slug}.md has no entry in sprint-status.yaml`,
      );
    }
  }

  // Check 3: epic rollups.
  for (const [epicKey, stories] of storiesByEpic) {
    const expected = rollupEpicStatus(stories.map((s) => s.status));
    const actual = yamlStatus[epicKey];
    if (actual === undefined) {
      problems.push(
        `  [missing epic] ${epicKey} has stories but no \`${epicKey}:\` entry in yaml`,
      );
      continue;
    }
    if (actual !== expected) {
      const storyList = stories
        .map((s) => `${s.key}=${s.status}`)
        .join(", ");
      problems.push(
        `  [rollup drift] ${epicKey}: yaml=\`${actual}\` expected=\`${expected}\` (${storyList})`,
      );
    }
  }

  if (problems.length === 0) {
    const storyCount = fileStatuses.size;
    const epicCount = yamlEpicKeys.size;
    console.log(
      `validate-sprint-status: OK (${storyCount} stories, ${epicCount} epics)`,
    );
    process.exit(0);
  }

  console.error("validate-sprint-status: drift detected");
  for (const p of problems) console.error(p);
  console.error("");
  console.error(
    "See docs/planning/architecture/adr-002-story-status-single-source-of-truth.md",
  );
  process.exit(1);
}

main();
