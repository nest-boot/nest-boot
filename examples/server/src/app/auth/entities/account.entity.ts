import { Entity } from '@mikro-orm/decorators/legacy';
import { BaseAccount } from '@nest-boot/auth';

/**
 * better-auth 第三方账号绑定实体。
 */
@Entity()
export class Account extends BaseAccount {}
