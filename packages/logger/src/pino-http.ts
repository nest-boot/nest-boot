import { type Request, type Response } from "express";
import createPinoHttp, { type HttpLogger } from "pino-http";

import { type LoggerModuleOptions } from "./logger-module-options.interface.js";

export type PinoHttpLogger = HttpLogger<Request, Response>;

const pinoHttp = createPinoHttp as unknown as (
  options?: LoggerModuleOptions,
) => PinoHttpLogger;

export default pinoHttp;
