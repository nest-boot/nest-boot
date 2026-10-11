import { defineConfig } from '@mikro-orm/postgresql';
import { entities as authEntities } from '@nest-boot/auth';
import { loadConfigFromEnv } from '@nest-boot/database';
import { entities as queueEntities } from '@nest-boot/queue/persistence';

import { configureJobMetadata } from './app/jobs/job-access.js';

/**
 * MikroORM 配置工厂。
 * @returns MikroORM configuration including the authentication entities.
 */
export default async () => {
  const config = (await loadConfigFromEnv()) as any;

  return defineConfig({
    ...config,
    discovery: { onMetadata: configureJobMetadata },
    entities: [...authEntities, ...queueEntities, ...(config.entities ?? [])],
    entitiesTs: [
      ...authEntities,
      ...queueEntities,
      ...(config.entitiesTs ?? []),
    ],
  });
};
