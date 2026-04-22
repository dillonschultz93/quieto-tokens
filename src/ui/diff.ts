import * as p from "@clack/prompts";
import { hexToAnsi, supportsColor } from "../utils/color-display.js";
import { normalizeHex } from "../utils/color.js";
import { sortCategoriesCanonical } from "../utils/categories.js";
import type {
  PrimitiveToken,
  SemanticToken,
  ThemeCollection,
} from "../types/tokens.js";

const DTCG_REFS_IN_VALUE = /\{([^}]+)\}/g;

export interface TokenChange {
  kind: "added" | "removed" | "modified";
  path: string[];
  name: string;
  category: string;
  $type: string;
  oldValue?: string;
  newValue?: string;
}

export interface TokenDiff {
  primitiveChanges: TokenChange[];
  semanticChanges: Map<string, TokenChange[]>;
  isEmpty: boolean;
}

function buildNameMap<T extends { name: string }>(
  items: T[],
): Map<string, T> {
  const m = new Map<string, T>();
  for (const it of items) {
    m.set(it.name, it);
  }
  return m;
}

function diffTwoMaps<T extends { name: string; $value: string; $type: string; category: string; path: string[] }>(
  prior: Map<string, T>,
  current: Map<string, T>,
): TokenChange[] {
  const out: TokenChange[] = [];
  for (const [name, nxt] of current) {
    const old = prior.get(name);
    if (old === undefined) {
      out.push({
        kind: "added",
        path: nxt.path,
        name,
        category: nxt.category,
        $type: nxt.$type,
        newValue: nxt.$value,
      });
    } else if (old.$value !== nxt.$value) {
      out.push({
        kind: "modified",
        path: nxt.path,
        name,
        category: nxt.category,
        $type: nxt.$type,
        oldValue: old.$value,
        newValue: nxt.$value,
      });
    }
  }
  for (const [name, old] of prior) {
    if (!current.has(name)) {
      out.push({
        kind: "removed",
        path: old.path,
        name,
        category: old.category,
        $type: old.$type,
        oldValue: old.$value,
      });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function computeTokenDiff(
  prior: ThemeCollection,
  current: ThemeCollection,
): TokenDiff {
  const primP = buildNameMap(prior.primitives);
  const primC = buildNameMap(current.primitives);
  const primitiveChanges = diffTwoMaps(primP, primC);

  const semanticChanges = new Map<string, TokenChange[]>();
  const priorByTheme = new Map(prior.themes.map((t) => [t.name, t] as const));
  const currentByTheme = new Map(
    current.themes.map((t) => [t.name, t] as const),
  );
  const themeNames = new Set<string>([
    ...priorByTheme.keys(),
    ...currentByTheme.keys(),
  ]);

  for (const tname of themeNames) {
    const tPrior = priorByTheme.get(tname);
    const tCurrent = currentByTheme.get(tname);
    const priorS = tPrior
      ? buildNameMap(tPrior.semanticTokens)
      : new Map<string, SemanticToken>();
    const currentS = tCurrent
      ? buildNameMap(tCurrent.semanticTokens)
      : new Map<string, SemanticToken>();
    const ch = diffTwoMaps(priorS, currentS);
    if (ch.length > 0) {
      semanticChanges.set(tname, ch);
    }
  }

  const isEmpty =
    primitiveChanges.length === 0 &&
    [...semanticChanges.values()].every((a) => a.length === 0);
  if (isEmpty) {
    semanticChanges.clear();
  }
  return { primitiveChanges, semanticChanges, isEmpty };
}

export interface RenderTokenDiffOptions {
  /**
   * When set, only changes whose token `category` is in this set are shown
   * (unmodified on-disk add-on categories stay out of the output per AC#20).
   */
  modifiedCategories?: ReadonlySet<string> | null;
}

function filterPrimitiveChanges(
  changes: readonly TokenChange[],
  modifiedCategories: ReadonlySet<string> | null,
): TokenChange[] {
  if (modifiedCategories === null || modifiedCategories === undefined) {
    return [...changes];
  }
  return changes.filter((c) => modifiedCategories.has(c.category));
}

function filterSemanticChanges(
  m: Map<string, TokenChange[]>,
  modifiedCategories: ReadonlySet<string> | null,
): Map<string, TokenChange[]> {
  if (modifiedCategories === null || modifiedCategories === undefined) {
    return new Map(m);
  }
  const out = new Map<string, TokenChange[]>();
  for (const [theme, arr] of m) {
    const f = arr.filter((c) => modifiedCategories.has(c.category));
    if (f.length > 0) out.set(theme, f);
  }
  return out;
}

const PRIMITIVE_CATEGORY_TITLES: Record<string, string> = {
  color: "Primitive Changes — Color",
  spacing: "Primitive Changes — Spacing",
  typography: "Primitive Changes — Typography",
  shadow: "Primitive Changes — Shadow",
  border: "Primitive Changes — Border",
  animation: "Primitive Changes — Animation",
};

function primitiveGroupKey(
  ch: TokenChange,
): { sub: string; order: string } {
  if (ch.category === "color" && ch.path.length > 1) {
    return { sub: ch.path[1]!, order: "color" };
  }
  if (ch.path.length > 1) {
    return { sub: ch.path[1]!, order: ch.category };
  }
  return { sub: "default", order: ch.category };
}

function formatPrimitiveLine(
  ch: TokenChange,
  colorOn: boolean,
  primitives: PrimitiveToken[],
): string {
  const isColor = ch.$type === "color" && ch.category === "color";
  if (ch.kind === "added") {
    if (isColor) {
      const h = ch.newValue ?? "";
      const sw = colorOn && isHexString(h) ? hexToAnsi(h) : "";
      return `+ ${ch.name}  ${sw}${h}`.replace(/\s+$/, " ").trimEnd();
    }
    return `+ ${ch.name}  ${ch.newValue ?? ""}`;
  }
  if (ch.kind === "removed") {
    if (isColor) {
      const h = ch.oldValue ?? "";
      const sw = colorOn && isHexString(h) ? dimSwatchOrPlain(hexToAnsi(h), colorOn) : "";
      return `− ${ch.name}  ${sw}${h}`.trimEnd();
    }
    return `− ${ch.name}  ${ch.oldValue ?? ""}`;
  }
  const o = ch.oldValue ?? "";
  const n = ch.newValue ?? "";
  if (isColor && isHexString(o) && isHexString(n)) {
    const sw1 = colorOn ? hexToAnsi(o) : "";
    const sw2 = colorOn ? hexToAnsi(n) : "";
    return `${ch.name}  ${sw1}${o} → ${sw2}${n}`.replace(/\s+/g, " ").trim();
  }
  return `${ch.name}  ${o} → ${n}`;
}

function dimSwatchOrPlain(ansi: string, colorOn: boolean): string {
  if (!colorOn) return "";
  return `${ansi} `;
}

function isHexString(s: string): boolean {
  try {
    void normalizeHex(s);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse `{a.b.c}` substrings from a DTCG $value; inner text is a primitive
 * name when it matches a leaf path.
 */
export function extractDtcgRefPaths($value: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  DTCG_REFS_IN_VALUE.lastIndex = 0;
  while ((m = DTCG_REFS_IN_VALUE.exec($value)) !== null) {
    out.push(m[1]!);
  }
  return out;
}

function findPrimitiveByName(
  name: string,
  primitives: readonly PrimitiveToken[],
): PrimitiveToken | undefined {
  return primitives.find((t) => t.name === name);
}

/** Display token for a DTCG reference string (e.g. `{color.blue.500}`) on a color semantic line. */
function derefSemanticColor(
  dtcgValue: string,
  colorOn: boolean,
  primitives: readonly PrimitiveToken[],
): string {
  const m = dtcgValue.match(/^\{color\.(\w+)\.(\d+)\}$/);
  if (m) {
    const pr = findPrimitiveByName(
      `color.${m[1]}.${m[2]}`,
      primitives,
    );
    const h = pr?.$value;
    if (h && isHexString(h) && colorOn) {
      return `${hexToAnsi(h)} ${dtcgValue}`;
    }
  }
  return dtcgValue;
}

function formatSemanticValueLine(
  ch: TokenChange,
  colorOn: boolean,
  primitives: PrimitiveToken[],
): string {
  const isSemColor = ch.$type === "color" && ch.category === "color";
  if (ch.kind === "added") {
    if (isSemColor) {
      return `+ ${ch.name}  → ${derefSemanticColor(
        ch.newValue!,
        colorOn,
        primitives,
      )}`;
    }
    return `+ ${ch.name}  ${ch.newValue!}`;
  }
  if (ch.kind === "removed") {
    if (isSemColor) {
      return `− ${ch.name}  → ${derefSemanticColor(
        ch.oldValue!,
        colorOn,
        primitives,
      )}`;
    }
    return `− ${ch.name}  ${ch.oldValue!}`;
  }
  const o = ch.oldValue!;
  const n = ch.newValue!;
  if (isSemColor) {
    return `${ch.name}  → ${derefSemanticColor(
      o,
      colorOn,
      primitives,
    )} → ${derefSemanticColor(n, colorOn, primitives)}`;
  }
  return `${ch.name}  → ${o} → ${n}`;
}

function groupPrimitiveChanges(
  list: readonly TokenChange[],
  cat: string,
): Map<string, TokenChange[]> {
  const bySub = new Map<string, TokenChange[]>();
  for (const ch of list.filter((c) => c.category === cat)) {
    const { sub } = primitiveGroupKey(ch);
    if (!bySub.has(sub)) bySub.set(sub, []);
    bySub.get(sub)!.push(ch);
  }
  for (const a of bySub.values()) {
    a.sort((x, y) => x.name.localeCompare(y.name));
  }
  return bySub;
}

function labelForSubkind(
  sub: string,
  kind: "added" | "removed" | "modified",
  count: number,
): string {
  const b = (s: string) => `${s} (${count} ${count === 1 ? "change" : "changes"})`;
  if (kind === "added") return `+ ${sub} ${b("added")}`;
  if (kind === "removed") return `− ${sub} ${b("removed")}`;
  return `${sub} (${count} modified)`;
}

/**
 * Renders a grouped token diff. Pass `primitives` from the **current**
 * pipeline collection so color refs can resolve to hex for swatches.
 */
export function renderTokenDiff(
  diff: TokenDiff,
  primitives: PrimitiveToken[],
  options?: RenderTokenDiffOptions,
): void {
  if (diff.isEmpty) {
    return;
  }
  const modCats = options?.modifiedCategories ?? null;
  const primF = filterPrimitiveChanges(diff.primitiveChanges, modCats);
  const semF = filterSemanticChanges(diff.semanticChanges, modCats);
  const colorOn = supportsColor();
  if (primF.length > 0) {
    const byCat = new Map<string, TokenChange[]>();
    for (const ch of primF) {
      if (!byCat.has(ch.category)) byCat.set(ch.category, []);
      byCat.get(ch.category)!.push(ch);
    }
    const order = sortCategoriesCanonical([...byCat.keys()]);
    for (const cat of order) {
      const chs = byCat.get(cat);
      if (!chs || chs.length === 0) continue;
      const title = PRIMITIVE_CATEGORY_TITLES[cat] ?? `Primitive Changes — ${cat}`;
      p.log.step(title);
      if (cat === "color") {
        const byHue = groupPrimitiveChanges(chs, "color");
        const sortedSub = [...byHue.keys()].sort((a, b) => a.localeCompare(b));
        for (const sub of sortedSub) {
          const inHue = byHue.get(sub) ?? [];
          for (const kind of ["modified", "added", "removed"] as const) {
            const part = inHue.filter((c) => c.kind === kind);
            if (part.length === 0) continue;
            p.log.info(labelForSubkind(sub, kind, part.length));
            const lines = part.map((c) =>
              formatPrimitiveLine(c, colorOn, primitives),
            );
            p.log.info(lines.map((l) => `  ${l}`).join("\n"));
          }
        }
      } else {
        for (const kind of ["modified", "added", "removed"] as const) {
          const part = chs.filter((c) => c.kind === kind);
          if (part.length === 0) continue;
          p.log.info(
            part
              .map((c) => `  ${formatPrimitiveLine(c, colorOn, primitives)}`)
              .join("\n"),
          );
        }
      }
    }
  }

  if (semF.size > 0) {
    for (const theme of [...semF.keys()].sort((a, b) => a.localeCompare(b))) {
      const changes = semF.get(theme) ?? [];
      if (changes.length === 0) continue;
      const displayTheme =
        theme === "default"
          ? "Semantic Changes (Default)"
          : `Semantic Changes (${
              theme.charAt(0).toUpperCase() + theme.slice(1)
            })`;
      p.log.step(displayTheme);
      const bySemCat = new Map<string, TokenChange[]>();
      for (const ch of changes) {
        if (!bySemCat.has(ch.category)) bySemCat.set(ch.category, []);
        bySemCat.get(ch.category)!.push(ch);
      }
      for (const cat of sortCategoriesCanonical([...bySemCat.keys()])) {
        const row = bySemCat.get(cat);
        if (!row || row.length === 0) continue;
        const catLabel = cat === "color" ? "Color" : cat;
        p.log.info(catLabel);
        const lines = row.map(
          (ch) => `  ${formatSemanticValueLine(ch, colorOn, primitives)}`,
        );
        p.log.info(lines.join("\n"));
      }
    }
  }
}

/**
 * Renders the cascade / broken-reference section after the detailed diff.
 */
export function renderCascadeSummary(
  diff: TokenDiff,
  current: ThemeCollection,
): void {
  const modPrim = diff.primitiveChanges.filter((c) => c.kind === "modified");
  const addPrim = diff.primitiveChanges.filter((c) => c.kind === "added");
  const remPrim = diff.primitiveChanges.filter((c) => c.kind === "removed");
  const byCatCount = new Map<string, number>();
  for (const c of diff.primitiveChanges) {
    byCatCount.set(c.category, (byCatCount.get(c.category) ?? 0) + 1);
  }
  const nPrim = diff.primitiveChanges.length;

  if (nPrim > 0) {
    const catParts: string[] = [];
    for (const cat of sortCategoriesCanonical([...byCatCount.keys()])) {
      const n = byCatCount.get(cat) ?? 0;
      if (n > 0) {
        catParts.push(`${n} ${cat} primitive${n === 1 ? "" : "s"}`);
      }
    }
    const head =
      catParts.length > 0
        ? `Changing ${catParts.join(" and ")}`
        : `Changing ${nPrim} token${nPrim === 1 ? "" : "s"}`;

    const changedNames = new Set(
      [
        ...modPrim.map((c) => c.name),
        ...addPrim.map((c) => c.name),
        ...remPrim.map((c) => c.name),
      ],
    );

    let mAffected = 0;
    const themesTouched = new Set<string>();
    for (const t of current.themes) {
      for (const st of t.semanticTokens) {
        for (const ref of extractDtcgRefPaths(st.$value)) {
          if (changedNames.has(ref)) {
            mAffected += 1;
            themesTouched.add(t.name);
            break;
          }
        }
      }
    }

    const k = themesTouched.size;
    if (mAffected > 0) {
      p.log.info(
        `◇  ${head} affects ${mAffected} semantic token${mAffected === 1 ? "" : "s"} across ${k} theme${k === 1 ? "" : "s"}.`,
      );
    } else {
      p.log.info("◇  No cascading semantic changes.");
    }
  }

  for (const rem of remPrim) {
    const rname = rem.name;
    for (const theme of current.themes) {
      for (const st of theme.semanticTokens) {
        for (const ref of extractDtcgRefPaths(st.$value)) {
          if (ref === rname) {
            p.log.warn(
              `⚠  ${st.name} still references removed primitive {${rname}}`,
            );
          }
        }
      }
    }
  }
}
