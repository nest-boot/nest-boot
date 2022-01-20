import { randomUUID } from "crypto";
import { Options } from "pino-http";

export const defaultPinoOptions: Options = {
  genReqId: () => randomUUID(),
};
