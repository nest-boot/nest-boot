import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { entities as authEntities } from '@nest-boot/auth';
import { DatabaseModule } from '@nest-boot/database';
import { GraphQLModule } from '@nest-boot/graphql';
import { GraphQLConnectionModule } from '@nest-boot/graphql-connection';
import { HashModule } from '@nest-boot/hash';
import { HealthCheckModule } from '@nest-boot/health-check';
import { LoggerModule } from '@nest-boot/logger';
import { MailerModule } from '@nest-boot/mailer';
import { RequestContextModule } from '@nest-boot/request-context';
import { Global, Module } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ConfigModule } from './modules/config.module.js';
import { createSessionContext } from './session-context.js';

const GraphQLDynamicModule = GraphQLModule.forRoot({
  context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
});

const DatabaseDynamicModule = DatabaseModule.forRoot({
  driver: PostgreSqlDriver,
  entities: [...authEntities, 'dist/**/*.entity.js'],
  entitiesTs: [...authEntities, 'src/**/*.entity.ts'],
  session: createSessionContext,
});

/** 服务端公共基础设施模块。 */
@Global()
@Module({
  imports: [
    RequestContextModule,
    ConfigModule,
    HashModule,
    MailerModule,
    DatabaseDynamicModule,
    HealthCheckModule,
    GraphQLDynamicModule,
    GraphQLConnectionModule,
    LoggerModule,
  ],
})
export class CommonModule {}
