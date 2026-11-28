import type { Config as MastraConfig } from "@mastra/core/mastra";

import type { ASYNC_OPTIONS_TYPE } from "../mastra.module-definition.js";
import type { MastraServerOptions } from "./mastra-server-options.interface.js";
import type { MastraStudioOptions } from "./mastra-studio-options.interface.js";

export type MastraModuleOptions = Omit<MastraConfig, "server" | "studio"> & {
  /**
   * Configure the Mastra HTTP routes and `@mastra/nestjs` server options.
   * - `false` / omitted: headless mode (disables Mastra HTTP routes and Studio by default)
   * - `true`: enables Mastra HTTP routes under `/api/mastra` (and Studio at `/api/mastra/studio`)
   * - object: enables and customizes `enabled`, `prefix`, `decorators`, and `@mastra/nestjs` server options
   */
  server?: boolean | MastraServerOptions;
  /**
   * Configure embedded Mastra Studio hosting at `${prefix}/studio`.
   * - omitted: enabled whenever `server` is enabled, disabled in headless mode
   * - `true`: enables Mastra Studio
   * - `false`: disables Mastra Studio
   * - object: customizes `enabled`, `hideCloudCta`, and `telemetryDisabled`
   */
  studio?: boolean | MastraStudioOptions;
};

export type MastraModuleAsyncOptions = typeof ASYNC_OPTIONS_TYPE;
