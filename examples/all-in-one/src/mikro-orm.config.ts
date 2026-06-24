import { defineConfig } from '@mikro-orm/postgresql';
import { loadConfigFromEnv } from '@nest-boot/mikro-orm';
import {
  RowLevelSecurityDriver,
  RowLevelSecurityMigrationGenerator,
} from '@nest-boot/row-level-security';

/** MikroORM 配置工厂。 */
export default async () => {
  const config = (await loadConfigFromEnv()) as any;

  return defineConfig({
    ...config,
    driver: RowLevelSecurityDriver,
    migrations: {
      ...config.migrations,
      generator: RowLevelSecurityMigrationGenerator,
    },
    schemaGenerator: {
      ignoreSchema: ['auth'],
    },
  });
};
