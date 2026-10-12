import { createRequire } from "node:module";

import type * as Clipanion from "clipanion";

// Clipanion 3's ESM build contains directory imports unsupported by Node.
// Its CommonJS build supports native Node; retain the exact public types.
const clipanion = createRequire(import.meta.url)(
  "clipanion",
) as typeof Clipanion;
export const { Builtins, Cli, Command: ClipanionCommand, Option } = clipanion;
