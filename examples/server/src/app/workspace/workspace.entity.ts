import type { Opt } from '@mikro-orm/core';
import { Collection, t } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  Index,
  OneToMany,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { BaseWorkspace, workspaceScopePolicy } from '@nest-boot/auth';
import { Field, ID, ObjectType } from '@nest-boot/graphql';
import { softDeletePolicies } from '@nest-boot/mikro-orm';
import { Sonyflake } from 'sonyflake-js';

import { WorkspaceMember } from '../workspace-member/workspace-member.entity.js';
import { WorkspaceFeature } from './enums/features.enum.js';

/**
 * 工作区实体。
 */
@ObjectType()
@Entity({
  policies: [
    {
      command: 'select',
      using: () => 'true',
      roles: ['authenticated', 'anonymous'],
    },
    workspaceScopePolicy({ property: 'id', command: 'update' }),
    // 创建和软删除由 WorkspaceService 授权后的隔离事务负责。
    ...softDeletePolicies(),
  ],
})
@Index({ properties: ['createdAt'] })
@Index({ properties: ['deletedAt'] })
export class Workspace extends BaseWorkspace {
  /** 工作区唯一标识。 */
  @Field(() => ID)
  @PrimaryKey({
    type: t.bigint,
  })
  override id: Opt<string> = Sonyflake.next().toString();

  /** 工作区名称。 */
  @Field(() => String)
  @Property({ type: t.string })
  declare name: string;

  /** 工作区已启用的功能。 */
  @Field(() => [WorkspaceFeature])
  @Enum({ items: () => WorkspaceFeature, array: true, defaultRaw: "'{}'" })
  features: Opt<WorkspaceFeature[]> = [];

  /** 创建时间。 */
  @Field(() => Date)
  @Property({ type: t.datetime, defaultRaw: 'now()' })
  override createdAt: Opt<Date> = new Date();

  /** 更新时间。 */
  @Field(() => Date)
  @Property({
    type: t.datetime,
    defaultRaw: 'now()',
    onUpdate: () => new Date(),
  })
  override updatedAt: Opt<Date> = new Date();

  /** 软删除时间，为空表示未删除。 */
  @Field(() => Date, { nullable: true })
  @Property({ type: t.datetime, nullable: true })
  declare deletedAt?: Date | null;

  /** 工作区成员集合。 */
  @OneToMany(() => WorkspaceMember, (member) => member.workspace)
  members = new Collection<WorkspaceMember>(this);
}
