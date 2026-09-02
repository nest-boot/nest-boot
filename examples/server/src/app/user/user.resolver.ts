import { Can, CurrentUser } from '@nest-boot/auth';
import { Query, Resolver } from '@nest-boot/graphql';

import { User } from './user.entity.js';

/**
 * 提供当前用户查询的 GraphQL 接口。
 */
@Resolver(() => User)
export class UserResolver {
  /**
   * 返回当前认证用户。
   *
   * @param user - 当前认证用户。
   * @returns 当前认证用户。
   */
  @Can('read', User, { scope: 'user' })
  @Query(() => User)
  currentUser(@CurrentUser() user: User) {
    return user;
  }
}
