import { Client } from "@notionhq/client";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { parse as parseYaml } from "yaml";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

config({ path: resolve(ROOT, ".env") });

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID;
let NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY) {
  console.error("Missing NOTION_API_KEY in .env");
  process.exit(1);
}

if (!NOTION_PAGE_ID && !NOTION_DATABASE_ID) {
  console.error("Missing NOTION_PAGE_ID or NOTION_DATABASE_ID in .env");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

const STATUS_MAP = {
  backlog: "Backlog",
  "ready-for-dev": "Ready for Dev",
  "in-progress": "In Progress",
  review: "Review",
  done: "Done",
  optional: "Backlog",
};

const STATUS_OPTIONS = [
  { name: "Backlog", color: "gray" },
  { name: "Ready for Dev", color: "blue" },
  { name: "In Progress", color: "yellow" },
  { name: "Review", color: "purple" },
  { name: "Done", color: "green" },
];

function loadSprintStatus() {
  const yamlPath = resolve(ROOT, "docs/planning/sprint-status.yaml");
  const content = readFileSync(yamlPath, "utf-8");
  return parseYaml(content);
}

function loadEpicTitles() {
  const epicsPath = resolve(ROOT, "docs/planning/epics.md");
  const content = readFileSync(epicsPath, "utf-8");

  const epicTitles = {};
  const storyTitles = {};

  const epicRegex = /^## Epic (\d+): (.+)$/gm;
  let match;
  while ((match = epicRegex.exec(content)) !== null) {
    epicTitles[match[1]] = match[2].trim();
  }

  const storyRegex = /^### Story (\d+)\.(\d+): (.+)$/gm;
  while ((match = storyRegex.exec(content)) !== null) {
    const key = `${match[1]}-${match[2]}`;
    storyTitles[key] = match[3].trim();
  }

  return { epicTitles, storyTitles };
}

function classifyEntry(key) {
  if (key.startsWith("epic-") && key.endsWith("-retrospective")) {
    const epicNum = key.replace("epic-", "").replace("-retrospective", "");
    return { type: "Retrospective", epicNum, label: `Epic ${epicNum} Retrospective` };
  }
  if (key.match(/^epic-\d+$/)) {
    const epicNum = key.replace("epic-", "");
    return { type: "Epic", epicNum, label: null };
  }
  const storyMatch = key.match(/^(\d+)-(\d+)-(.+)$/);
  if (storyMatch) {
    return {
      type: "Story",
      epicNum: storyMatch[1],
      storyNum: storyMatch[2],
      slug: storyMatch[3],
      label: null,
    };
  }
  return { type: "Unknown", epicNum: "0", label: key };
}

function buildEntries(sprintData, epicTitles, storyTitles) {
  const entries = [];
  let priority = 0;

  for (const [key, status] of Object.entries(sprintData.development_status)) {
    priority++;
    const info = classifyEntry(key);
    const epicTitle = epicTitles[info.epicNum] || `Epic ${info.epicNum}`;
    const epicLabel = `Epic ${info.epicNum}: ${epicTitle}`;

    let title;
    if (info.type === "Epic") {
      title = epicLabel;
    } else if (info.type === "Story") {
      const storyKey = `${info.epicNum}-${info.storyNum}`;
      const storyTitle = storyTitles[storyKey] || info.slug.replace(/-/g, " ");
      title = `${info.epicNum}.${info.storyNum}: ${storyTitle}`;
    } else {
      title = info.label;
    }

    entries.push({
      key,
      title,
      status: STATUS_MAP[status] || "Backlog",
      type: info.type,
      epicLabel,
      priority,
    });
  }

  return entries;
}

function saveDatabaseId(dbId) {
  const envPath = resolve(ROOT, ".env");
  let content = readFileSync(envPath, "utf-8");

  if (content.includes("NOTION_DATABASE_ID=")) {
    content = content.replace(/NOTION_DATABASE_ID=.*/, `NOTION_DATABASE_ID=${dbId}`);
  } else {
    content = content.trimEnd() + `\nNOTION_DATABASE_ID=${dbId}\n`;
  }

  writeFileSync(envPath, content);
  NOTION_DATABASE_ID = dbId;
}

async function createDatabase(entries) {
  if (NOTION_DATABASE_ID) {
    console.log(`Database already exists (${NOTION_DATABASE_ID}). Use sync mode to update.`);
    return;
  }

  console.log("Creating Notion database...");

  const epicLabels = [...new Set(entries.map((e) => e.epicLabel))];

  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: NOTION_PAGE_ID },
    title: [{ text: { content: "Quieto Tokens - Sprint Board" } }],
    initial_data_source: {
      properties: {
        Name: { title: {} },
        Status: {
          select: {
            options: STATUS_OPTIONS,
          },
        },
        Type: {
          select: {
            options: [
              { name: "Epic", color: "orange" },
              { name: "Story", color: "blue" },
              { name: "Retrospective", color: "gray" },
            ],
          },
        },
        Epic: {
          select: {
            options: epicLabels.map((label) => ({ name: label })),
          },
        },
        "Story Key": { rich_text: {} },
        Priority: { number: {} },
      },
    },
  });

  console.log(`Database created: ${db.id}`);
  saveDatabaseId(db.id);

  console.log(`Creating ${entries.length} pages...`);

  for (const entry of entries) {
    await notion.pages.create({
      parent: { database_id: db.id },
      properties: {
        Name: { title: [{ text: { content: entry.title } }] },
        Status: { select: { name: entry.status } },
        Type: { select: { name: entry.type } },
        Epic: { select: { name: entry.epicLabel } },
        "Story Key": { rich_text: [{ text: { content: entry.key } }] },
        Priority: { number: entry.priority },
      },
    });
    process.stdout.write(".");
  }

  console.log(`\nDone! ${entries.length} pages created.`);
  console.log("Open your Notion database and switch to Board view grouped by Status.");
}

async function getDataSourceId(databaseId) {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  return db.data_sources[0].id;
}

async function syncStatuses(entries) {
  if (!NOTION_DATABASE_ID) {
    console.error("No NOTION_DATABASE_ID found. Run with --init first.");
    process.exit(1);
  }

  console.log("Syncing statuses to Notion...");

  const dataSourceId = await getDataSourceId(NOTION_DATABASE_ID);

  const existingPages = [];
  let cursor;
  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
    });
    existingPages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  const pagesByKey = {};
  for (const page of existingPages) {
    const keyProp = page.properties["Story Key"];
    if (keyProp?.rich_text?.[0]?.plain_text) {
      pagesByKey[keyProp.rich_text[0].plain_text] = page;
    }
  }

  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    const page = pagesByKey[entry.key];
    if (!page) {
      console.log(`  New entry: ${entry.title} (not in Notion, skipping)`);
      skipped++;
      continue;
    }

    const currentStatus = page.properties.Status?.select?.name;
    if (currentStatus === entry.status) {
      continue;
    }

    await notion.pages.update({
      page_id: page.id,
      properties: {
        Status: { select: { name: entry.status } },
      },
    });

    console.log(`  Updated: ${entry.title} | ${currentStatus} -> ${entry.status}`);
    updated++;
  }

  console.log(`\nSync complete. ${updated} updated, ${skipped} new (not synced).`);
}

async function main() {
  const isInit = process.argv.includes("--init");

  const sprintData = loadSprintStatus();
  const { epicTitles, storyTitles } = loadEpicTitles();
  const entries = buildEntries(sprintData, epicTitles, storyTitles);

  if (isInit) {
    await createDatabase(entries);
  } else {
    await syncStatuses(entries);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
