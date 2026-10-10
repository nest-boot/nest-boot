import { defineConfig } from '@mikro-orm/postgresql';
import { entities as authEntities } from '@nest-boot/auth';
import { loadConfigFromEnv } from '@nest-boot/database';

/**
 * MikroORM 配置工厂。
 * @returns MikroORM configuration including the authentication entities.
 */
export default async () => {
  const config = (await loadConfigFromEnv()) as any;

  return defineConfig({
    ...config,
    entities: [...authEntities, ...(config.entities ?? [])],
    entitiesTs: [...authEntities, ...(config.entitiesTs ?? [])],
  });
};
