import { withAuthDatabaseConfig } from '@nest-boot/auth';
import { getDatabaseConfig } from '@nest-boot/database';
import { withQueueDatabaseConfig } from '@nest-boot/queue';

/**
 * MikroORM 配置工厂，供 CLI 和应用运行时共用。
 * @returns Database configuration including authentication and native queue entities.
 */
export default async () =>
  withQueueDatabaseConfig(withAuthDatabaseConfig(await getDatabaseConfig()));
