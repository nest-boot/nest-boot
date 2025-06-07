import { Inject } from "@nestjs/common";

import { getQueueToken } from "../utils";

export const InjectQueue = (name = "default"): ParameterDecorator =>
  Inject(getQueueToken(name));
