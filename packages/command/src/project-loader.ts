import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Resolves a CLI entry relative to the application working directory.
 * @param cwd - Application directory.
 * @param production - Prefer compiled output when true.
 * @returns The first existing entry file.
 */
export function resolveCliEntry(cwd: string, production: boolean): string {
  const candidates = production
    ? ["dist/cli.js", "src/cli.ts"]
    : ["src/cli.ts", "dist/cli.js"];
  for (const candidate of candidates) {
    const path = resolve(cwd, candidate);
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  throw new Error(
    `CLI entry not found in ${cwd}. Expected ${candidates.join(", ")}.`,
  );
}
