import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    clean: true,
    target: "node18",
    splitting: false,
    sourcemap: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    target: "node18",
    splitting: false,
    sourcemap: true,
  },
]);
