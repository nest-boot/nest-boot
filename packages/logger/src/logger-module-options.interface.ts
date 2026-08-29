import { type Options } from "pino-http";

/**
 * Pino HTTP options compatible with Nest's standard logger methods.
 *
 * @remarks
 * Custom levels may be added, but the standard levels used by {@link Logger}
 * cannot be removed.
 */
export type LoggerModuleOptions = Omit<Options, "useOnlyCustomLevels"> & {
  /** Must remain disabled so Nest's standard logger methods stay available. */
  useOnlyCustomLevels?: false;
};
