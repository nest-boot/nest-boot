import { defineConfig } from '@mikro-orm/postgresql';
import { entities as authEntities } from '@nest-boot/auth';
import { loadConfigFromEnv } from '@nest-boot/database';
import {
  entities as queueEntities,
  jobSchemaGeneratorOptions,
} from '@nest-boot/queue/persistence';

/**
 * MikroORM 配置工厂。
 * @returns MikroORM configuration including the authentication entities.
 */
export default async () => {
  const config = (await loadConfigFromEnv()) as any;

  return defineConfig({
    ...config,
    schemaGenerator: {
      ...jobSchemaGeneratorOptions,
      // Preserve the legacy mirror until its data is archived separately.
      skipTables: [...jobSchemaGeneratorOptions.skipTables, 'job'],
    },
    entities: [...authEntities, ...queueEntities, ...(config.entities ?? [])],
    entitiesTs: [
      ...authEntities,
      ...queueEntities,
      ...(config.entitiesTs ?? []),
    ],
  });
};
