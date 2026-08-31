import { Entity } from '@mikro-orm/decorators/legacy';
import { BaseSession } from '@nest-boot/auth';

/**
 * better-auth 用户会话实体。
 */
@Entity()
export class Session extends BaseSession {}
