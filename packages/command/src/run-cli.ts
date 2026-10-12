import "reflect-metadata";

import { pathToFileURL } from "node:url";

import { registerTypeScript, resolveCliEntry } from "./project-loader.js";

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
  const hooks = entry.endsWith(".ts")
    ? await registerTypeScript(entry)
    : undefined;
  process.argv[1] = entry;
  try {
    await import(pathToFileURL(entry).href);
    // A void bootstrap() can outlive module evaluation. Keep TypeScript hooks
    // for the process lifetime so its later dynamic imports remain supported.
  } catch (error) {
    hooks?.deregister();
    throw error;
  }
}
