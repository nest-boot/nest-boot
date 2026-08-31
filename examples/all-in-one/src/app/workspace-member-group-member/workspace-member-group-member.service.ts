import { EntityManager } from '@mikro-orm/postgresql';
import { EntityService } from '@nest-boot/mikro-orm';
import { Injectable } from '@nestjs/common';

import { WorkspaceMemberGroupMember } from './workspace-member-group-member.entity.js';

/** 工作区成员组关系服务。 */
@Injectable()
export class WorkspaceMemberGroupMemberService extends EntityService<WorkspaceMemberGroupMember> {
  /**
   * 创建工作区成员组关系服务。
   *
   * @param em - MikroORM 实体管理器。
   */
  constructor(
    /** MikroORM 实体管理器。 */
    protected readonly em: EntityManager,
  ) {
    super(WorkspaceMemberGroupMember, em);
  }
}
