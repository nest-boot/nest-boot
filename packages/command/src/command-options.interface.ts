import type { Usage } from "clipanion";

/** Command paths, aliases and help text shared with Clipanion. */
export interface CommandOptions {
  /** Each path is a command or alias, for example [["database", "migrate"]]. */
  paths: string[][];
  /** Description, details, examples and category shown in help. */
  usage?: Usage;
}
