import type { LoadedTokenSystem } from "./token-loader.js";

export interface NamingViolation {
  tokenPath: string[];
  tier: string;
  reason: string;
}

const VALID_SEGMENT = /^[a-z0-9][a-z0-9-]*$/;

export function validateNaming(
  system: LoadedTokenSystem,
): NamingViolation[] {
  const violations: NamingViolation[] = [];

  for (const t of system.primitives) {
    checkPath(t.path, "primitive", violations);
  }

  for (const theme of system.themes) {
    for (const t of theme.semantics) {
      checkPath(t.path, "semantic", violations);
    }
  }

  for (const t of system.components) {
    checkPath(t.path, "component", violations);
  }

  return violations;
}

function checkPath(
  path: string[],
  tier: string,
  violations: NamingViolation[],
): void {
  if (path.length === 0) {
    violations.push({ tokenPath: path, tier, reason: "Empty token path" });
    return;
  }

  for (const segment of path) {
    if (segment.length === 0) {
      violations.push({
        tokenPath: path,
        tier,
        reason: "Empty segment in path",
      });
    } else if (!VALID_SEGMENT.test(segment)) {
      violations.push({
        tokenPath: path,
        tier,
        reason: `Segment "${segment}" contains invalid characters (expected lowercase alphanumeric + hyphens)`,
      });
    }
  }
}
