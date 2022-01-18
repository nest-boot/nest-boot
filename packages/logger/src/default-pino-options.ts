import { Options } from "pino-http";
import * as uuid from "uuid";

export const defaultPinoOptions: Options = {
  genReqId: () => uuid.v4(),
};
