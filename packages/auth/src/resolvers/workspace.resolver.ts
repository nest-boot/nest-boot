import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";
import type { ConnectionArgsInterface } from "@nest-boot/graphql-connection";

import {
  ApiKeyConnection,
  ApiKeyConnectionArgs,
} from "../connections/api-key.connection-definition.js";
import {
  InvitationConnection,
  InvitationConnectionArgs,
} from "../connections/invitation.connection-definition.js";
import {
  MemberConnection,
  MemberConnectionArgs,
} from "../connections/member.connection-definition.js";
import { CurrentMember } from "../decorators/current-member.decorator.js";
import { CurrentUser } from "../decorators/current-user.decorator.js";
import { ApiKey } from "../entities/api-key.entity.js";
import { type Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { CreateWorkspaceInput } from "../inputs/create-workspace.input.js";
import { UpdateWorkspaceInput } from "../inputs/update-workspace.input.js";
import { ApiKeyService } from "../services/api-key.service.js";
import { InvitationService } from "../services/invitation.service.js";
import { MemberService } from "../services/member.service.js";
import { WorkspaceService } from "../services/workspace.service.js";
import { CreateWorkspacePayload } from "../types/create-workspace-payload.type.js";
import { DeleteWorkspacePayload } from "../types/delete-workspace-payload.type.js";
import { LeaveWorkspacePayload } from "../types/leave-workspace-payload.type.js";

/**
 * 提供工作区查询、创建、更新和删除的 GraphQL 接口。
 */
@Resolver(() => Workspace)
export class WorkspaceResolver {
  /**
   * 创建工作区 Resolver。
   *
   * @param workspaceService - 工作区业务服务。
   * @param apiKeyService - API Key 业务服务。
   * @param memberService - 工作区成员业务服务。
   * @param invitationService - 工作区邀请业务服务。
   */
  constructor(
    readonly workspaceService: WorkspaceService,
    readonly apiKeyService: ApiKeyService,
    readonly memberService: MemberService,
    readonly invitationService: InvitationService,
  ) {}

  /** 分页查询父级工作区的成员。 */
  @ResolveField(() => MemberConnection)
  async members(
    @Parent() workspace: Workspace,
    @Args({ type: () => MemberConnectionArgs })
    args: ConnectionArgsInterface<Member>,
  ) {
    return await this.memberService.getMemberConnectionByWorkspace(
      workspace,
      args,
    );
  }

  /** 查询父级工作区拥有且当前身份可访问的单个 API Key。 */
  @ResolveField(() => ApiKey, { nullable: true })
  async apiKey(
    @Parent() workspace: Workspace,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<ApiKey | null> {
    return await this.apiKeyService.getWorkspaceApiKey(id, workspace);
  }

  /** 分页查询父级工作区的 API Key。 */
  @ResolveField(() => ApiKeyConnection)
  async apiKeys(
    @Parent() workspace: Workspace,
    @Args({ type: () => ApiKeyConnectionArgs })
    args: ConnectionArgsInterface<ApiKey>,
  ) {
    return await this.apiKeyService.getApiKeyConnectionByWorkspace(
      workspace,
      args,
    );
  }

  /** 分页查询父级工作区的邀请，权限与查询均由服务处理。 */
  @ResolveField(() => InvitationConnection)
  async invitations(
    @Parent() workspace: Workspace,
    @Args({ type: () => InvitationConnectionArgs })
    args: ConnectionArgsInterface<Invitation>,
  ) {
    return await this.invitationService.getInvitationConnectionByWorkspace(
      workspace,
      args,
    );
  }

  /**
   * 返回当前请求选择的工作区。
   *
   * @returns 当前工作区；请求未选择工作区时返回 null。
   */
  @Query(() => Workspace, { nullable: true })
  currentWorkspace(): Workspace | null {
    return this.workspaceService.getCurrentWorkspace();
  }

  /**
   * 按标识查询单个工作区。
   *
   * @param id - 工作区标识。
   * @returns 匹配的工作区；不存在时返回空值。
   */
  @Query(() => Workspace, { nullable: true })
  async workspace(
    @Args({ name: "id", type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<Workspace | null> {
    return await this.workspaceService.getUserWorkspace(id, user);
  }

  /**
   * 为当前用户创建新工作区。
   *
   * @param user - 当前认证用户。
   * @param input - 创建工作区输入参数。
   * @returns 新建工作区的标识；后续请求需显式选择该工作区。
   */
  @Mutation(() => CreateWorkspacePayload)
  async createWorkspace(
    @CurrentUser() user: User,
    @Args("input") input: CreateWorkspaceInput,
  ): Promise<CreateWorkspacePayload> {
    const workspace = await this.workspaceService.createWorkspace(user, input);
    return { id: workspace.id };
  }

  /**
   * 更新当前工作区信息。
   *
   * @param id - 当前工作区的标识。
   * @param input - 更新工作区输入参数。
   * @returns 更新后的工作区。
   */
  @Mutation(() => Workspace)
  async updateWorkspace(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateWorkspaceInput,
  ): Promise<Workspace> {
    return await this.workspaceService.updateWorkspace(id, input);
  }

  /**
   * 软删除当前工作区。
   *
   * @param id - 当前工作区的标识。
   * @returns 已软删除工作区的标识。
   */
  @Mutation(() => DeleteWorkspacePayload)
  async deleteWorkspace(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<DeleteWorkspacePayload> {
    const workspace = await this.workspaceService.deleteWorkspace(id);
    return { id: workspace.id };
  }

  /** Leaves the workspace and returns the removed member's ID. */
  @Mutation(() => LeaveWorkspacePayload)
  async leaveWorkspace(
    @CurrentMember() member: Member,
  ): Promise<LeaveWorkspacePayload> {
    const removed = await this.memberService.leaveWorkspace(member);
    return { memberId: removed.id };
  }
}
