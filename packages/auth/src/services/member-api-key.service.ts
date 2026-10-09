import { EntityManager, type FilterQuery, Reference } from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/sql";
import {
  type ConnectionArgsInterface,
  ConnectionManager,
  type ConnectionResult,
} from "@nest-boot/graphql-connection";
import { RequestContext } from "@nest-boot/request-context";
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { GraphQLResolveInfo } from "graphql";

import { MODULE_OPTIONS_TOKEN } from "../auth.module-definition.js";
import type { AuthModuleOptions } from "../auth-module-options.interface.js";
import { MemberApiKeyConnection } from "../connections/member-api-key.connection-definition.js";
import { Member } from "../entities/member.entity.js";
import { MemberApiKey } from "../entities/member-api-key.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { ApiKeyLifecycle } from "../infrastructure/api-key-lifecycle.js";
import { RequestIdentity } from "../infrastructure/request-identity.js";
import type { CreateMemberApiKeyOptions } from "../interfaces/create-member-api-key-options.interface.js";
import type { CreatedApiKey } from "../interfaces/created-api-key.interface.js";
import type { UpdateApiKeyOptions } from "../interfaces/update-api-key-options.interface.js";
import type { MemberApiKeyPermissionOption } from "../objects/member-api-key-permission-option.object.js";
import type { ApiKeyMetadata } from "../types/api-key-metadata.type.js";
import {
  normalizeApiKeyPermissions,
  resolveApiKeyPermissionCatalog,
} from "../utils/api-key-permissions.util.js";
import { authorize } from "../utils/authorize.util.js";
import { getCurrentApiKey } from "../utils/get-current-api-key.util.js";
import { omitCredentials } from "../utils/omit-credentials.util.js";
import {
  assertApiKeyPermissionCeiling,
  assertCanGrantPermissions,
  assertPermissionCeiling,
  canGrantPermissions,
} from "../utils/permission-grants.util.js";
import { resolveMemberPermissions } from "../utils/resolve-effective-permissions.util.js";
import { resolveRequestPermissions } from "../utils/resolve-request-permissions.util.js";

/** Manages member-owned, workspace-scoped API keys within the current request's authorization scope. */
@Injectable()
export class MemberApiKeyService {
  private readonly logger = new Logger(MemberApiKeyService.name);

  /** Creates an API-key domain service. */
  constructor(
    /** MikroORM entity manager used for API-key persistence. */
    protected readonly em: EntityManager,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly authOptions: AuthModuleOptions,
  ) {}

  /** Lists API-key grants available to the caller in the selected workspace. */
  getMemberApiKeyPermissions(
    workspace: Workspace,
  ): MemberApiKeyPermissionOption[] {
    RequestIdentity.assertCurrentWorkspace(workspace);
    const { permissions, allowed, defaults } = resolveApiKeyPermissionCatalog(
      this.authOptions,
      "member",
    );
    const allowedSet = new Set(allowed);
    return permissions.map((permission) => ({
      permission,
      default: defaults.includes(permission),
      grantable:
        allowedSet.has(permission) &&
        canGrantPermissions(this.authOptions, "workspace", [permission]),
    }));
  }

  /** Returns a member-owned key in the selected workspace and within the caller's scope. */
  async getMemberApiKey(
    id: string,
    workspace: Workspace,
  ): Promise<ApiKeyMetadata<MemberApiKey> | null> {
    this.assertWorkspacePrincipal(workspace);
    authorize("read", MemberApiKey);
    const apiKey = await this.getVisibleApiKey(id, workspace);
    if (apiKey) {
      authorize("read", apiKey);
    }
    return apiKey ? omitCredentials(apiKey, ["key"]) : null;
  }

  /** Paginates all selected-workspace member keys within the caller's permission ceilings. */
  async getMemberApiKeyConnection(
    workspace: Workspace,
    args: ConnectionArgsInterface<MemberApiKey>,
    info?: GraphQLResolveInfo,
  ): Promise<ConnectionResult<ApiKeyMetadata<MemberApiKey>>> {
    this.assertWorkspacePrincipal(workspace);
    authorize("read", MemberApiKey);
    const where = this.getOwnedListFilter(workspace);
    const connection = await new ConnectionManager(
      this.em as SqlEntityManager,
    ).find(MemberApiKeyConnection, args, {
      ...(info && { info }),
      where,
      populate: ["member.workspace"],
      exclude: ["key"],
    });
    // Reject the whole page rather than silently changing cursor pagination.
    for (const { node } of connection.edges) {
      authorize("read", node);
    }
    return {
      ...connection,
      edges: connection.edges.map((edge) => ({
        ...edge,
        node: omitCredentials(edge.node, ["key"]),
      })),
    };
  }

  /** Creates an API key owned by a workspace member. */
  async createMemberApiKey(
    workspace: Workspace,
    options: CreateMemberApiKeyOptions,
  ): Promise<CreatedApiKey<MemberApiKey>> {
    this.assertWorkspacePrincipal(workspace);
    authorize("write", MemberApiKey);
    const permissions = normalizeApiKeyPermissions(
      this.authOptions,
      "member",
      options.permissions,
    );
    const member = await this.getCreationMember(workspace, options.member);
    this.assertMemberPermissionCeiling(member, permissions);
    return await this.createKey(member, options, permissions);
  }

  /** Updates a member-owned key in the selected workspace. */
  async updateMemberApiKey(
    id: string,
    input: UpdateApiKeyOptions,
  ): Promise<ApiKeyMetadata<MemberApiKey>> {
    authorize("write", MemberApiKey);
    const apiKey = await this.findWritableApiKey(id);
    authorize("write", apiKey);
    const permissions =
      input.permissions === undefined
        ? undefined
        : normalizeApiKeyPermissions(
            this.authOptions,
            "member",
            input.permissions ?? [],
          );
    // Allow disabling stale grants without replacing them.
    if (input.enabled !== false || permissions !== undefined) {
      const finalPermissions =
        permissions ??
        normalizeApiKeyPermissions(
          this.authOptions,
          "member",
          apiKey.permissions ?? [],
        );
      this.assertMemberPermissionCeiling(
        Reference.unwrapReference(apiKey.member),
        finalPermissions,
      );
    }
    return omitCredentials(
      await ApiKeyLifecycle.update(
        this.em,
        this.authOptions,
        apiKey,
        input,
        permissions,
      ),
      ["key"],
    );
  }

  /** Deletes a member-owned key in the selected workspace. */
  async deleteMemberApiKey(id: string): Promise<ApiKeyMetadata<MemberApiKey>> {
    authorize("write", MemberApiKey);
    const apiKey = await this.findWritableApiKey(id);
    authorize("write", apiKey);
    return omitCredentials(
      await ApiKeyLifecycle.delete(this.em, this.authOptions, apiKey),
      ["key"],
    );
  }

  private async getCreationMember(
    workspace: Workspace,
    owner?: Member | string,
  ): Promise<Member> {
    const member =
      typeof owner === "string"
        ? await this.em.findOne(
            Member,
            { id: owner, workspace },
            { populate: ["workspace", "user"], refresh: true },
          )
        : (owner ?? RequestContext.get(Member));
    if (!member) throw new NotFoundException("Workspace member not found");
    if (member.status !== "ACTIVE")
      throw new ForbiddenException("An active workspace member is required");
    if (member.workspace.id !== workspace.id)
      throw new ForbiddenException(
        "The operation belongs to another workspace",
      );
    if (
      member.type !== "SERVICE_ACCOUNT" &&
      (!RequestContext.get(User) ||
        !member.user ||
        member.user.id !== RequestContext.get(User)?.id)
    ) {
      throw new ForbiddenException(
        "You may only create API keys for yourself or a service account",
      );
    }
    return member;
  }

  private async createKey(
    member: Member,
    options: CreateMemberApiKeyOptions,
    permissions: string[],
  ): Promise<CreatedApiKey<MemberApiKey>> {
    const { apiKey, data } = ApiKeyLifecycle.prepareCreation(
      options,
      permissions,
      this.authOptions.apiKey?.member?.defaultPrefix ??
        process.env.API_KEY_PREFIX ??
        "ws_",
    );
    const entity = await this.em.transactional(
      async (em) => {
        const entity = em.create(MemberApiKey, {
          ...data,
          member,
        });
        authorize("write", entity);
        await em.persist(entity).flush();
        return entity;
      },
      { clear: true },
    );
    this.logger.log("API key created", {
      apiKeyId: entity.id,
      ownerId: member.id,
      ownerType: "member",
    });
    return { apiKey, entity };
  }

  private async getVisibleApiKey(
    id: string,
    workspace: Workspace,
  ): Promise<ApiKeyMetadata<MemberApiKey> | null> {
    const apiKey = await this.em.findOne(
      MemberApiKey,
      {
        $and: [{ id }, this.getOwnedListFilter(workspace)],
      },
      { populate: ["member.workspace"], exclude: ["key"] },
    );
    if (apiKey) {
      this.assertWorkspace(apiKey, workspace);
      assertApiKeyPermissionCeiling(this.authOptions, apiKey.permissions ?? []);
    }
    return apiKey;
  }

  private async findWritableApiKey(
    id: string,
  ): Promise<ApiKeyMetadata<MemberApiKey>> {
    const apiKey = await this.em.findOne(
      MemberApiKey,
      { id },
      {
        populate: ["member.workspace"],
        exclude: ["key"],
        refresh: true,
      },
    );
    if (!apiKey) {
      throw new NotFoundException("API key not found");
    }
    this.assertWorkspacePrincipal(this.unwrapWorkspace(apiKey));
    assertApiKeyPermissionCeiling(this.authOptions, apiKey.permissions ?? []);
    return apiKey;
  }

  private getOwnedListFilter(workspace: Workspace): FilterQuery<MemberApiKey> {
    const ceiling = resolveRequestPermissions(this.authOptions).apiKey;
    return {
      member: { workspace },
      ...(ceiling !== null
        ? { permissions: { $contained: ceiling, $ne: [] } }
        : {}),
    };
  }

  private assertWorkspacePrincipal(workspace: Workspace): void {
    RequestIdentity.assertCurrentWorkspace(workspace);
    const apiKey = getCurrentApiKey();
    if (apiKey && apiKey instanceof MemberApiKey) {
      this.assertWorkspace(apiKey, workspace);
    }
    const member = RequestContext.get(Member);
    if (member?.status !== "ACTIVE") {
      throw new ForbiddenException("An active workspace member is required");
    }
    RequestIdentity.assertCurrentMember(member);
    if (Reference.unwrapReference(member.workspace).id !== workspace.id) {
      throw new ForbiddenException(
        "Workspace member does not belong to this workspace",
      );
    }
  }

  private assertWorkspace(
    apiKey: ApiKeyMetadata<MemberApiKey>,
    expectedWorkspace: Workspace,
  ): void {
    const workspace = this.unwrapWorkspace(apiKey);
    if (workspace.id !== expectedWorkspace.id) {
      throw new ForbiddenException(
        "You are not allowed to access this API key",
      );
    }
  }

  private unwrapWorkspace(apiKey: ApiKeyMetadata<MemberApiKey>): Workspace {
    if (!apiKey.member)
      throw new ForbiddenException("API key owner is missing");
    return Reference.unwrapReference(
      Reference.unwrapReference(apiKey.member).workspace,
    );
  }

  private assertMemberPermissionCeiling(
    member: Member,
    permissions: readonly string[],
  ): void {
    const ownerPermissions = resolveMemberPermissions(this.authOptions, member);
    if (!permissions.length)
      assertApiKeyPermissionCeiling(this.authOptions, permissions);
    assertPermissionCeiling(
      permissions,
      ownerPermissions,
      "Member API key permissions exceed owner permissions",
    );
    assertCanGrantPermissions(
      this.authOptions,
      "workspace",
      permissions.length ? permissions : ownerPermissions,
    );
  }
}
