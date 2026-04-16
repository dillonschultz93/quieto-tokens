import * as p from "@clack/prompts";
import type { QuickStartOptions } from "../types.js";
import { normalizeHex } from "../utils/color.js";
import { validateHexColor } from "../utils/validation.js";

function handleCancel(value: unknown): asserts value is string | number | boolean {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled.");
    throw new Error("cancelled");
  }
}

export async function quickStartFlow(): Promise<QuickStartOptions> {
  const brandColorRaw = await p.text({
    message: "What is your primary brand color?",
    placeholder: "#5B21B6",
    validate: validateHexColor,
  });
  handleCancel(brandColorRaw);

  const spacingBase = await p.select({
    message: "Choose a spacing base:",
    options: [
      {
        value: 4 as const,
        label: "4px base",
        hint: "Tighter, more compact — common in data-dense UIs",
      },
      {
        value: 8 as const,
        label: "8px base",
        hint: "Roomier, more spacious — the most popular choice",
      },
    ],
  });
  handleCancel(spacingBase);

  const typeScale = await p.select({
    message: "Choose a type scale:",
    options: [
      {
        value: "compact" as const,
        label: "Compact (Minor Third — 1.200)",
        hint: "Subtle size steps, good for dense interfaces",
      },
      {
        value: "balanced" as const,
        label: "Balanced (Major Third — 1.250)",
        hint: "Versatile and harmonious — the default choice",
      },
      {
        value: "spacious" as const,
        label: "Spacious (Perfect Fourth — 1.333)",
        hint: "Dramatic size contrast, good for marketing sites",
      },
    ],
  });
  handleCancel(typeScale);

  const generateThemes = await p.confirm({
    message: "Generate both light and dark themes?",
    initialValue: true,
  });
  handleCancel(generateThemes);

  const brandColor = normalizeHex((brandColorRaw as string).trim());

  return {
    brandColor,
    spacingBase: spacingBase as 4 | 8,
    typeScale: typeScale as QuickStartOptions["typeScale"],
    generateThemes: generateThemes as boolean,
  };
}
