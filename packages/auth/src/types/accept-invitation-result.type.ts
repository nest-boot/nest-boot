import { Field, ObjectType } from "@nest-boot/graphql";

import { Invitation } from "../entities/invitation.entity.js";
import { Member } from "../entities/member.entity.js";

/** 接受工作区邀请后的返回结果。 */
@ObjectType()
export class AcceptInvitationResult {
  /** 已标记为接受的邀请。 */

  @Field(() => Invitation)
  invitation!: Invitation;

  /** 接受邀请时创建的工作区成员。 */

  @Field(() => Member)
  member!: Member;
}
