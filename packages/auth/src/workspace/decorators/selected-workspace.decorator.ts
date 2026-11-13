import { RequestContext } from "@nest-boot/request-context";
import { createParamDecorator } from "@nestjs/common";

import { SELECTED_WORKSPACE } from "../../core/constants/auth.constants.js";
import { Workspace } from "../entities/workspace.entity.js";

/** Parameter decorator that injects the workspace selected for the current request. */
export const SelectedWorkspace = createParamDecorator(
  () => RequestContext.get<Workspace | null>(SELECTED_WORKSPACE) ?? null,
);
