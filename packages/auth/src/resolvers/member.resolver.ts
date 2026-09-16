import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nest-boot/graphql";

import { CurrentWorkspace } from "../decorators/current-workspace.decorator.js";
import { Member } from "../entities/member.entity.js";
import { User } from "../entities/user.entity.js";
import { Workspace } from "../entities/workspace.entity.js";
import { AddMemberInput } from "../inputs/add-member.input.js";
import { SetMemberPermissionsInput } from "../inputs/set-member-permissions.input.js";
import { SetMemberRolesInput } from "../inputs/set-member-roles.input.js";
import { UpdateMemberInput } from "../inputs/update-member.input.js";
import { MemberService } from "../services/member.service.js";
import { RemoveMemberPayload } from "../types/remove-member-payload.type.js";

/** 工作区成员 GraphQL 解析器。 */
@Resolver(() => Member)
export class MemberResolver {
  /**
   * 创建工作区成员解析器。
   *
   */
  constructor(
    /** Auth-owned workspace role and permission operations. */
    readonly memberService: MemberService,
  ) {}

  /** Resolves the user associated with a workspace member. */
  @ResolveField(() => User, { nullable: true })
  async user(@Parent() member: Member): Promise<User | null> {
    return await this.memberService.getMemberUser(member);
  }

  /** Lists configured workspace roles. */
  @Query(() => [String])
  workspaceRoles(): string[] {
    return this.memberService.listRoles().map(({ name }) => name);
  }

  /** Lists permissions available to workspace roles. */
  @Query(() => [String])
  workspacePermissions(): string[] {
    return this.memberService.listPermissions();
  }

  /**
   * 获取当前请求中的工作区成员。
   *
   * @returns 当前工作区成员；请求未解析出成员时返回 null。
   */
  @Query(() => Member, { nullable: true })
  currentMember(): Member | null {
    return this.memberService.getCurrentMember();
  }

  /**
   * 根据 ID 查询工作区成员。
   *
   * @param id - 工作区成员 ID。
   * @returns 匹配的工作区成员，不存在时返回 null。
   */
  @Query(() => Member, { nullable: true })
  async member(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Member | null> {
    return await this.memberService.getMember(id);
  }

  /**
   * 通过邮箱直接添加已有用户为工作区成员。
   *
   * @param workspace - 当前工作区。
   * @param input - 添加成员输入参数。
   * @returns 新创建的工作区成员。
   */
  @Mutation(() => Member)
  async addMember(
    @CurrentWorkspace() workspace: Workspace,
    @Args("input") input: AddMemberInput,
  ): Promise<Member> {
    return await this.memberService.addMemberByEmail(workspace, input.email);
  }

  /**
   * 更新工作区成员信息。
   *
   * @param id - 待更新的工作区成员 ID。
   * @param input - 成员更新参数。
   * @returns 更新后的工作区成员。
   */
  @Mutation(() => Member, { nullable: true })
  async updateMember(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: UpdateMemberInput,
  ): Promise<Member | null> {
    return await this.memberService.updateMember(id, input);
  }

  /** Replaces roles assigned to a non-owner workspace member. */
  @Mutation(() => Member)
  async setMemberRoles(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetMemberRolesInput,
  ): Promise<Member> {
    return await this.memberService.setMemberRoles(id, input.roles);
  }

  /** Replaces direct permissions assigned to a workspace member. */
  @Mutation(() => Member)
  async setMemberPermissions(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: SetMemberPermissionsInput,
  ): Promise<Member> {
    return await this.memberService.setMemberPermissions(id, input.permissions);
  }

  /**
   * 移除工作区成员。
   *
   * @param id - 待移除的工作区成员 ID。
   * @returns 被移除的工作区成员标识。
   */
  @Mutation(() => RemoveMemberPayload)
  async removeMember(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<RemoveMemberPayload> {
    const member = await this.memberService.removeMember(id);
    return { id: member.id };
  }
}
