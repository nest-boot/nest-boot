import { withAuthDatabaseConfig } from '@nest-boot/auth';
import {
  type DatabaseModuleOptions,
  getDatabaseConfig,
} from '@nest-boot/database';
import { JobEntity } from '@nest-boot/queue-api';

/**
 * MikroORM 配置工厂，供 CLI 和应用运行时共用。
 * @returns Database configuration including authentication and Job history.
 */
export default async (): Promise<DatabaseModuleOptions> => {
  const config = withAuthDatabaseConfig(await getDatabaseConfig());
  return {
    ...config,
    entities: [...config.entities, JobEntity],
    entitiesTs: [...config.entitiesTs, JobEntity],
  };
};
