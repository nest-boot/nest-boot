import type { Opt } from '@mikro-orm/core';
import { Collection, t } from '@mikro-orm/core';
import {
  Entity,
  Index,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { BaseUser } from '@nest-boot/auth';
import { Field, ID, ObjectType } from '@nest-boot/graphql';
import { Policy, PolicyCommand } from '@nest-boot/row-level-security';
import { Sonyflake } from 'sonyflake-js';

import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';

/**
 * 应用用户实体。
 */
@Policy({
  name: 'user_select_policy',
  command: PolicyCommand.SELECT,
  using: '(true)',
  roles: ['authenticated'],
})
@Policy({
  name: 'user_update_policy',
  command: PolicyCommand.UPDATE,
  property: 'id',
  context: 'user_id',
  roles: ['authenticated'],
})
@ObjectType()
@Entity()
@Index({ properties: ['createdAt'] })
export class User extends BaseUser {
  /** 用户唯一标识。 */
  @Field(() => ID)
  @PrimaryKey({ type: t.bigint })
  id: Opt<string> = Sonyflake.next().toString();

  /** 用户显示名称。 */
  @Field(() => String)
  @Property({ type: t.string })
  declare name: string;

  /** 用户邮箱。 */
  @Field(() => String)
  @Property({ type: t.string })
  declare email: string;

  /** 创建时间。 */
  @Field(() => Date)
  @Property({ type: t.datetime, defaultRaw: 'now()' })
  createdAt: Opt<Date> = new Date();

  /** 更新时间。 */
  @Field(() => Date)
  @Property({
    type: t.datetime,
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  updatedAt: Opt<Date> = new Date();

  /** 用户加入的工作区成员关系集合。 */
  @OneToMany(() => WorkspaceMember, (member) => member.user)
  workspaceMembers = new Collection<WorkspaceMember>(this);
}
