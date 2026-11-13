import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { Session } from "../entities/session.entity.js";

/** Parameter decorator that injects the current {@link Session} from the request context. */
export const CurrentSession = createParamDecorator(() =>
  RequestContext.get(Session),
);
