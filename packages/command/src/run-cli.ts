import "reflect-metadata";

import { register as registerLoader } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { resolveCliEntry } from "./project-loader.js";

/** Settings for locating and executing an application's CLI entry script. */
export interface RunCliOptions {
  /** Application directory; defaults to process.cwd(), not the home directory. */
  cwd?: string;
  /** Prefer dist/cli.js; defaults to NODE_ENV === "production". */
  production?: boolean;
}

/**
 * Executes a project's CLI entry, which owns its bootstrap and exit code.
 * @param options - Project directory and entry resolution settings.
 */
export async function runCli(options: RunCliOptions = {}): Promise<void> {
  const entry = resolveCliEntry(
    options.cwd ?? process.cwd(),
    options.production ?? process.env.NODE_ENV === "production",
  );
  process.argv[1] = entry;
  if (entry.endsWith(".ts")) {
    registerLoader("./ts-node.loader.js", {
      parentURL: import.meta.url,
      data: {
        cwd: resolve(options.cwd ?? process.cwd()),
        projectSearchDir: dirname(entry),
        transpileOnly: true,
        experimentalResolver: true,
        preferTsExts: true,
      },
    });
  }
  await import(pathToFileURL(entry).href);
}
