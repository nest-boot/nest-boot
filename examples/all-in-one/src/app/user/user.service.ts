import { EntityManager } from '@mikro-orm/postgresql';
import { EntityService } from '@nest-boot/mikro-orm';
import { Injectable } from '@nestjs/common';

import { User } from './user.entity.js';

/**
 * 用户实体服务。
 */
@Injectable()
export class UserService extends EntityService<User> {
  /**
   * 创建用户服务。
   *
   * @param em - 当前请求使用的 MikroORM `EntityManager`。
   */
  constructor(protected readonly em: EntityManager) {
    super(User, em);
  }
}
