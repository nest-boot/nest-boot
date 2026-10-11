import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { entities as authEntities } from '@nest-boot/auth';
import { CommandModule } from '@nest-boot/command';
import { DatabaseModule } from '@nest-boot/database';
import { GraphQLModule } from '@nest-boot/graphql';
import { GraphQLConnectionModule } from '@nest-boot/graphql-connection';
import { HashModule } from '@nest-boot/hash';
import { HealthCheckModule } from '@nest-boot/health-check';
import { LoggerModule } from '@nest-boot/logger';
import { MailerModule } from '@nest-boot/mailer';
import { entities as queueEntities } from '@nest-boot/queue/persistence';
import { RequestContextModule } from '@nest-boot/request-context';
import { Global, Module } from '@nestjs/common';
import type { Request, Response } from 'express';

import { GreetCommand } from './commands/greet.command.js';
import { configureJobMetadata } from '../app/jobs/job-access.js';
import { ConfigModule } from './modules/config.module.js';
import { createSessionContext } from './session-context.js';

const GraphQLDynamicModule = GraphQLModule.forRoot({
  context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
});

const DatabaseDynamicModule = DatabaseModule.forRoot({
  driver: PostgreSqlDriver,
  discovery: { onMetadata: configureJobMetadata },
  entities: [...authEntities, ...queueEntities, 'dist/**/*.entity.js'],
  entitiesTs: [...authEntities, ...queueEntities, 'src/**/*.entity.ts'],
  session: createSessionContext,
});

/** 服务端公共基础设施模块。 */
@Global()
@Module({
  imports: [
    CommandModule,
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
  providers: [GreetCommand],
})
export class CommonModule {}
