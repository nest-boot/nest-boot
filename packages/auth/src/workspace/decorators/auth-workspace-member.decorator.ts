import { createParamDecorator } from "@nestjs/common";

import { resolveRequestWorkspaceMember } from "../utils/resolve-request-workspace-member.util.js";

/** Parameter decorator that injects the workspace member for the current request. */
export const AuthWorkspaceMember = createParamDecorator(() =>
  resolveRequestWorkspaceMember(),
);
