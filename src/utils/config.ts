import { existsSync } from "node:fs";
import { resolve } from "node:path";

const CONFIG_FILENAME = "quieto.config.json";

export function getConfigPath(cwd: string = process.cwd()): string {
  return resolve(cwd, CONFIG_FILENAME);
}

export function configExists(cwd: string = process.cwd()): boolean {
  return existsSync(getConfigPath(cwd));
}
