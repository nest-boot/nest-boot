import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { BaseSession } from "../entities/session.entity";

/** Parameter decorator that injects the current {@link BaseSession} from the request context. */
export const CurrentSession = createParamDecorator(() =>
  RequestContext.get(BaseSession),
);
