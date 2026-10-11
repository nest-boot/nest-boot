import type {
  EntityMetadata,
  FilterQuery,
  PolicyCallback,
} from '@mikro-orm/core';
import { Member, User, Workspace } from '@nest-boot/auth';
import { Job } from '@nest-boot/queue/persistence';
import { RequestContext } from '@nest-boot/request-context';

const matchesJobIdentity: PolicyCallback<Job> = (columns) =>
  `("${columns.data}" ->> 'userId' = nullif(current_setting('app.user.id', true), '') OR "${columns.data}" ->> 'workspaceId' = nullif(current_setting('app.workspace.id', true), ''))`;

/**
 * Retains the application's native RLS policy on the framework-owned entity.
 * @param meta - Discovered ORM entity metadata.
 */
export function configureJobMetadata(meta: EntityMetadata): void {
  if (meta.class !== Job) return;
  meta.policies = [
    {
      command: 'all',
      roles: ['authenticated'],
      using: matchesJobIdentity,
      check: matchesJobIdentity,
    },
  ];
}

/**
 * Scopes job reads to verified user or workspace identity, including service accounts.
 * @returns The visible job scope, or null for unauthenticated access.
 */
export function getJobReadFilter(): FilterQuery<Job> | null {
  if (!RequestContext.isActive()) return null;
  const user = RequestContext.get(User);
  const member = RequestContext.get(Member);
  if (!user && !member) return null;
  const workspace = RequestContext.get(Workspace);
  const scopes: FilterQuery<Job>[] = [];
  if (user?.id) scopes.push({ data: { userId: String(user.id) } });
  if (workspace?.id)
    scopes.push({ data: { workspaceId: String(workspace.id) } });
  return scopes.length ? { $or: scopes } : null;
}
