import * as p from "@clack/prompts";
import type { ThemeCollection } from "../types/tokens.js";
import type { PrimitiveToken } from "../types/tokens.js";

const DTCG_REF_RE = /^\{([^}]+)\}$/;

export interface OverrideConflict {
  semanticName: string;
  /** Inner reference path, e.g. `color.teal.500` */
  reference: string;
}

function extractRef(value: string): string | undefined {
  const m = value.trim().match(DTCG_REF_RE);
  return m?.[1];
}

function primitivePathExists(
  inner: string,
  primitives: readonly PrimitiveToken[],
): boolean {
  return primitives.some((t) => t.name === inner);
}

/**
 * Detect semantic overrides whose DTCG primitive reference no longer exists
 * in the rebuilt primitive set.
 */
export function detectOverrideConflicts(
  overrides: Record<string, string>,
  collection: ThemeCollection,
): OverrideConflict[] {
  const conflicts: OverrideConflict[] = [];
  const prims = collection.primitives;
  for (const [semanticName, raw] of Object.entries(overrides)) {
    const inner = extractRef(raw);
    if (inner === undefined) continue;
    if (!primitivePathExists(inner, prims)) {
      conflicts.push({ semanticName, reference: inner });
    }
  }
  return conflicts;
}

function semanticCategory(semanticName: string): string {
  const i = semanticName.indexOf(".");
  return i === -1 ? semanticName : semanticName.slice(0, i);
}

function handleCancel<T>(value: T | symbol): asserts value is T {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    throw new Error("cancelled");
  }
}

/**
 * Present resolution UI for each conflict. Returns a new overrides map
 * (conflicts resolved per user choice; non-conflicting keys preserved).
 */
export async function resolveOverrideConflicts(
  conflicts: OverrideConflict[],
  overrides: Record<string, string>,
  collection: ThemeCollection,
): Promise<Record<string, string>> {
  if (conflicts.length === 0) {
    return { ...overrides };
  }

  const out: Record<string, string> = { ...overrides };
  const prims = collection.primitives;

  for (const c of conflicts) {
    const category = semanticCategory(c.semanticName);
    const candidates = prims.filter((t) => t.category === category);
    const choice = await p.select({
      message: `Override "${c.semanticName}" points to missing token "{${c.reference}}". How should we proceed?`,
      options: [
        {
          value: "remap" as const,
          label: "Remap to default",
          hint: "Remove this override so the mapper default applies",
        },
        {
          value: "choose" as const,
          label: "Choose new value",
          hint: "Pick a different primitive reference",
        },
        {
          value: "keep" as const,
          label: "Keep (stale reference — CSS may break)",
          hint: "Leave the override unchanged",
        },
      ],
    });
    handleCancel(choice);

    if (choice === "remap") {
      delete out[c.semanticName];
    } else if (choice === "keep") {
      p.log.warn(
        `Keeping stale override for "${c.semanticName}" → {${c.reference}}.`,
      );
    } else {
      if (candidates.length === 0) {
        p.log.warn(
          `No ${category} primitives available — removing override for "${c.semanticName}".`,
        );
        delete out[c.semanticName];
        continue;
      }
      const primChoice = await p.select({
        message: `Pick a new primitive reference for "${c.semanticName}":`,
        options: [
          ...candidates.map((t) => ({
            value: `{${t.name}}`,
            label: `{${t.name}}`,
            hint: `${t.$type}: ${typeof t.$value === "string" && t.$value.length > 48 ? `${t.$value.slice(0, 45)}…` : String(t.$value)}`,
          })),
        ],
      });
      handleCancel(primChoice);
      out[c.semanticName] = primChoice as string;
    }
  }

  return out;
}
