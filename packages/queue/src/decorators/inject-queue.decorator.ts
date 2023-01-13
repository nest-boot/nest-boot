import { Inject } from "@nestjs/common";

import { getQueueToken } from "../utils/get-queue-token.util";

export const InjectQueue = (name?: string): ParameterDecorator =>
  Inject(typeof name !== "undefined" && getQueueToken(name));
