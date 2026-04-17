import { describe, it, expect } from "vitest";
import {
  generateShadowPrimitives,
  SHADOW_MAX_LEVELS,
  SHADOW_MIN_LEVELS,
} from "../shadow.js";

describe("generateShadowPrimitives", () => {
  it("emits `levels`-many tokens under shadow.elevation.<n>", () => {
    const tokens = generateShadowPrimitives({
      levels: 4,
      colorRef: "{color.neutral.900}",
      profile: "soft",
    });
    expect(tokens.map((t) => t.name)).toEqual([
      "shadow.elevation.1",
      "shadow.elevation.2",
      "shadow.elevation.3",
      "shadow.elevation.4",
    ]);
    for (const t of tokens) {
      expect(t.category).toBe("shadow");
      expect(t.tier).toBe("primitive");
      expect(t.$type).toBe("shadow");
      expect(t.path[0]).toBe("shadow");
      expect(t.path[1]).toBe("elevation");
    }
  });

  it("serialises the DTCG composite shadow object as JSON in $value", () => {
    const tokens = generateShadowPrimitives({
      levels: 2,
      colorRef: "{color.neutral.900}",
      profile: "soft",
    });
    const parsed = JSON.parse(tokens[0]!.$value) as Record<string, string>;
    expect(parsed).toEqual({
      color: "{color.neutral.900}",
      offsetX: "0px",
      offsetY: "1px",
      blur: "2px",
      spread: "0px",
    });
  });

  it("honours the hard profile preset", () => {
    const tokens = generateShadowPrimitives({
      levels: 3,
      colorRef: "{color.neutral.900}",
      profile: "hard",
    });
    const parsed = JSON.parse(tokens[0]!.$value) as Record<string, string>;
    expect(parsed.blur).toBe("0px");
    expect(parsed.offsetY).toBe("1px");
  });

  it("clamps levels below the minimum to 2", () => {
    const tokens = generateShadowPrimitives({
      levels: 0,
      colorRef: "{color.neutral.900}",
      profile: "soft",
    });
    expect(tokens).toHaveLength(SHADOW_MIN_LEVELS);
  });

  it("clamps levels above the maximum to 6", () => {
    const tokens = generateShadowPrimitives({
      levels: 99,
      colorRef: "{color.neutral.900}",
      profile: "soft",
    });
    expect(tokens).toHaveLength(SHADOW_MAX_LEVELS);
  });

  it("uses the provided colorRef verbatim", () => {
    const tokens = generateShadowPrimitives({
      levels: 2,
      colorRef: "{color.brand.700}",
      profile: "soft",
    });
    const parsed = JSON.parse(tokens[0]!.$value) as Record<string, string>;
    expect(parsed.color).toBe("{color.brand.700}");
  });

  it("produces monotonically non-decreasing offsetY + blur", () => {
    const tokens = generateShadowPrimitives({
      levels: 6,
      colorRef: "{color.neutral.900}",
      profile: "soft",
    });
    let prevY = -1;
    let prevBlur = -1;
    for (const t of tokens) {
      const parsed = JSON.parse(t.$value) as {
        offsetY: string;
        blur: string;
      };
      const y = parseInt(parsed.offsetY, 10);
      const b = parseInt(parsed.blur, 10);
      expect(y).toBeGreaterThanOrEqual(prevY);
      expect(b).toBeGreaterThanOrEqual(prevBlur);
      prevY = y;
      prevBlur = b;
    }
  });
});
