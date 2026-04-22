import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("@clack/prompts", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { _fs, prune } from "../pruner.js";

function touch(path: string): void {
  writeFileSync(path, "{}\n", "utf-8");
}

describe("prune", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "quieto-prune-"));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("is a no-op when the on-disk file set matches canonical", async () => {
    const primitiveDir = join(tempDir, "tokens", "primitive");
    const semanticDir = join(tempDir, "tokens", "semantic", "light");
    mkdirSync(primitiveDir, { recursive: true });
    mkdirSync(semanticDir, { recursive: true });
    touch(join(primitiveDir, "color.json"));
    touch(join(semanticDir, "color.json"));

    const result = await prune(tempDir, ["color"], ["light"]);
    expect(result.removed).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(existsSync(join(primitiveDir, "color.json"))).toBe(true);
  });

  it("removes orphaned primitive files not in canonical", async () => {
    const primitiveDir = join(tempDir, "tokens", "primitive");
    mkdirSync(primitiveDir, { recursive: true });
    touch(join(primitiveDir, "color.json"));
    touch(join(primitiveDir, "shadow.json"));
    touch(join(primitiveDir, "border.json"));

    const result = await prune(tempDir, ["color"], []);
    expect(existsSync(join(primitiveDir, "color.json"))).toBe(true);
    expect(existsSync(join(primitiveDir, "shadow.json"))).toBe(false);
    expect(existsSync(join(primitiveDir, "border.json"))).toBe(false);
    expect(result.removed).toHaveLength(2);
  });

  it("removes orphaned semantic files for every named theme", async () => {
    const lightDir = join(tempDir, "tokens", "semantic", "light");
    const darkDir = join(tempDir, "tokens", "semantic", "dark");
    mkdirSync(lightDir, { recursive: true });
    mkdirSync(darkDir, { recursive: true });
    touch(join(lightDir, "color.json"));
    touch(join(lightDir, "shadow.json"));
    touch(join(darkDir, "color.json"));
    touch(join(darkDir, "shadow.json"));

    await prune(tempDir, ["color"], ["light", "dark"]);
    expect(existsSync(join(lightDir, "shadow.json"))).toBe(false);
    expect(existsSync(join(darkDir, "shadow.json"))).toBe(false);
    expect(existsSync(join(lightDir, "color.json"))).toBe(true);
    expect(existsSync(join(darkDir, "color.json"))).toBe(true);
  });

  it("handles missing directories without erroring", async () => {
    const result = await prune(tempDir, ["color"], ["light"]);
    expect(result.removed).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("ignores non-json files in the watched directories", async () => {
    const primitiveDir = join(tempDir, "tokens", "primitive");
    mkdirSync(primitiveDir, { recursive: true });
    touch(join(primitiveDir, "readme.md"));
    touch(join(primitiveDir, "shadow.json"));

    await prune(tempDir, ["color"], []);
    expect(existsSync(join(primitiveDir, "readme.md"))).toBe(true);
    expect(existsSync(join(primitiveDir, "shadow.json"))).toBe(false);
  });

  it("does NOT touch tokens/component/*.json (Story 2.3 territory)", async () => {
    const componentDir = join(tempDir, "tokens", "component");
    mkdirSync(componentDir, { recursive: true });
    touch(join(componentDir, "button.json"));

    await prune(tempDir, ["color"], []);
    expect(existsSync(join(componentDir, "button.json"))).toBe(true);
  });

  it("is best-effort on unlink failure: other files still removed, errors collected", async () => {
    const primitiveDir = join(tempDir, "tokens", "primitive");
    mkdirSync(primitiveDir, { recursive: true });
    touch(join(primitiveDir, "shadow.json"));
    touch(join(primitiveDir, "border.json"));

    const realUnlink = _fs.unlink;
    const spy = vi
      .spyOn(_fs, "unlink")
      .mockImplementationOnce(async () => {
        throw Object.assign(new Error("EBUSY"), { code: "EBUSY" });
      });

    try {
      const result = await prune(tempDir, [], []);
      expect(result.errors).toHaveLength(1);
      expect(result.removed.length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
      _fs.unlink = realUnlink;
    }
  });

  describe("component pruning", () => {
    it("removes orphaned component files not in knownComponents", async () => {
      const componentDir = join(tempDir, "tokens", "component");
      mkdirSync(componentDir, { recursive: true });
      touch(join(componentDir, "button.json"));
      touch(join(componentDir, "old-card.json"));

      const result = await prune(tempDir, [], [], ["button"]);
      expect(result.removed).toHaveLength(1);
      expect(result.removed[0]).toContain("old-card.json");
      expect(existsSync(join(componentDir, "button.json"))).toBe(true);
      expect(existsSync(join(componentDir, "old-card.json"))).toBe(false);
    });

    it("removes all component files when knownComponents is empty", async () => {
      const componentDir = join(tempDir, "tokens", "component");
      mkdirSync(componentDir, { recursive: true });
      touch(join(componentDir, "button.json"));
      touch(join(componentDir, "modal.json"));

      const result = await prune(tempDir, [], [], []);
      expect(result.removed).toHaveLength(2);
      expect(existsSync(join(componentDir, "button.json"))).toBe(false);
      expect(existsSync(join(componentDir, "modal.json"))).toBe(false);
    });

    it("tolerates a missing tokens/component/ directory (ENOENT)", async () => {
      const result = await prune(tempDir, [], [], ["button"]);
      expect(result.errors).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it("skips component pruning when knownComponents is undefined", async () => {
      const componentDir = join(tempDir, "tokens", "component");
      mkdirSync(componentDir, { recursive: true });
      touch(join(componentDir, "button.json"));

      const result = await prune(tempDir, [], []);
      expect(result.removed).toHaveLength(0);
      expect(existsSync(join(componentDir, "button.json"))).toBe(true);
    });
  });
});
