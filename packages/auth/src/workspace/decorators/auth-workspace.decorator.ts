import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { Workspace } from "../entities/workspace.entity.js";

/** Injects the request's authenticated workspace scope, or null for selection alone. */
export const AuthWorkspace = createParamDecorator(
  () => RequestContext.get(Workspace) ?? null,
);
