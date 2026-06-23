import { createRequire } from "node:module";

import { type Request, type Response } from "express";
import type { HttpLogger } from "pino-http";

import { type LoggerModuleOptions } from "./logger-module-options.interface.js";

const require = createRequire(import.meta.url);

const pinoHttp = require("pino-http") as (
  options?: LoggerModuleOptions,
) => HttpLogger<Request, Response>;

export default pinoHttp;
