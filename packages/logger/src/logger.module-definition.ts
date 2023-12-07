import { ConfigurableModuleBuilder } from "@nestjs/common";

import { type LoggerModuleOptions } from "./logger-module-options.interface";

export const PINO_LOGGER = Symbol("PINO_LOGGER");

export const BINDINGS = Symbol("BINDINGS");

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<LoggerModuleOptions>().build();
