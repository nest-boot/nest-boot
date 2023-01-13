import { Inject } from "@nestjs/common";

import { createQueueToken } from "../utils/create-queue-token.util";

export const InjectQueue = (name?: string): ParameterDecorator =>
  Inject(typeof name !== "undefined" && createQueueToken(name));
