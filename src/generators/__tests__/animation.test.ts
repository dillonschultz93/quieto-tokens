import { describe, it, expect } from "vitest";
import {
  ANIMATION_EASING_PRESETS,
  generateAnimationPrimitives,
} from "../animation.js";

describe("generateAnimationPrimitives", () => {
  it("emits a duration primitive per unique ms value", () => {
    const tokens = generateAnimationPrimitives({
      durations: [100, 150, 250, 400],
      easing: "standard",
    });
    const durations = tokens.filter((t) => t.path[1] === "duration");
    expect(durations).toHaveLength(4);
    for (const t of durations) {
      expect(t.category).toBe("animation");
      expect(t.tier).toBe("primitive");
      expect(t.$type).toBe("duration");
      expect(t.$value).toMatch(/^\d+ms$/);
    }
  });

  it("always emits exactly three easing primitives: default / enter / exit", () => {
    for (const easing of ["standard", "emphasized", "decelerated"] as const) {
      const tokens = generateAnimationPrimitives({
        durations: [100],
        easing,
      });
      const eases = tokens.filter((t) => t.path[1] === "easing");
      expect(eases.map((t) => t.path[2]).sort()).toEqual([
        "default",
        "enter",
        "exit",
      ]);
      for (const t of eases) {
        expect(t.$type).toBe("cubicBezier");
        const parsed = JSON.parse(t.$value) as number[];
        expect(parsed).toHaveLength(4);
        for (const n of parsed) {
          expect(typeof n).toBe("number");
        }
      }
    }
  });

  it("wires the chosen preset through to the emitted bezier values", () => {
    const tokens = generateAnimationPrimitives({
      durations: [100],
      easing: "emphasized",
    });
    const enter = tokens.find((t) => t.name === "animation.easing.enter")!;
    const parsed = JSON.parse(enter.$value) as number[];
    expect(parsed).toEqual(ANIMATION_EASING_PRESETS.emphasized.enter);
  });

  it("sorts and dedupes durations defensively", () => {
    const tokens = generateAnimationPrimitives({
      durations: [400, 100, 250, 100, 150],
      easing: "standard",
    });
    const ordered = tokens
      .filter((t) => t.path[1] === "duration")
      .map((t) => t.path[2]);
    expect(ordered).toEqual(["100", "150", "250", "400"]);
  });

  it("drops non-integer / non-positive durations", () => {
    const tokens = generateAnimationPrimitives({
      durations: [0, -1, 1.5, Number.NaN, 200],
      easing: "standard",
    });
    const durations = tokens.filter((t) => t.path[1] === "duration");
    expect(durations).toHaveLength(1);
    expect(durations[0]!.$value).toBe("200ms");
  });
});
