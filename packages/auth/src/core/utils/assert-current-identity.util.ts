import { RequestContext } from "@nest-boot/request-context";
import { ForbiddenException } from "@nestjs/common";

import { getCurrentApiKey } from "../../api-key/utils/get-current-api-key.util.js";
import { Workspace } from "../../workspace/entities/workspace.entity.js";
import { WorkspaceMember } from "../../workspace/entities/workspace-member.entity.js";
import { Session } from "../entities/session.entity.js";
import { User } from "../entities/user.entity.js";

/**
 * Validates the identity bound to a self-service operation.
 * @param user - Value used for this operation.
 */
export function assertCurrentUser(user: User): void {
  const currentUser = RequestContext.isActive()
    ? RequestContext.get(User)
    : undefined;

  if (!currentUser || String(currentUser.id) !== String(user.id)) {
    throw new ForbiddenException("The operation belongs to another user");
  }
}

/**
 * Validates the identity bound to a self-service operation.
 * @param user - Value used for this operation.
 */
export function assertUserSession(user: User): void {
  assertCurrentUser(user);
  if (getCurrentApiKey()) {
    throw new ForbiddenException(
      "This self-service operation requires a user session",
    );
  }
}

/**
 * Validates the identity bound to a self-service operation.
 * @param session - Value used for this operation.
 */
export function assertCurrentSession(session: Session): void {
  const currentSession = RequestContext.isActive()
    ? RequestContext.get(Session)
    : undefined;

  if (currentSession?.token !== session.token) {
    throw new ForbiddenException("The operation belongs to another session");
  }
}

/**
 * Validates the identity bound to a self-service operation.
 * @param workspace - Value used for this operation.
 */
export function assertCurrentWorkspace(workspace: Workspace): void {
  const currentWorkspace = RequestContext.isActive()
    ? RequestContext.get(Workspace)
    : undefined;

  if (
    !currentWorkspace ||
    String(currentWorkspace.id) !== String(workspace.id)
  ) {
    throw new ForbiddenException("The operation belongs to another workspace");
  }
}

/**
 * Validates the identity bound to a self-service operation.
 * @param member - Value used for this operation.
 */
export function assertCurrentWorkspaceMember(
  member: WorkspaceMember | null | undefined,
): void {
  const currentWorkspaceMember = RequestContext.isActive()
    ? RequestContext.get(WorkspaceMember)
    : undefined;

  if (
    !member ||
    !currentWorkspaceMember ||
    String(currentWorkspaceMember.id) !== String(member.id)
  ) {
    throw new ForbiddenException(
      "The operation belongs to another workspace member",
    );
  }
}
