import { Module } from '@nestjs/common';

import { UserResolver } from './user.resolver.js';
import { UserService } from './user.service.js';

/**
 * 用户功能模块。
 */
@Module({
  providers: [UserResolver, UserService],
  exports: [UserService],
})
export class UserModule {}
