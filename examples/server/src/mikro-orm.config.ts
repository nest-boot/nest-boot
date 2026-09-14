import { defineConfig } from '@mikro-orm/postgresql';
import { loadConfigFromEnv } from '@nest-boot/mikro-orm';

/** MikroORM 配置工厂。 */
export default async () => {
  const config = (await loadConfigFromEnv()) as any;

  return defineConfig({
    ...config,
    schemaGenerator: {
      ignoreSchema: ['auth'],
    },
  });
};
