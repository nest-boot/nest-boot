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
import {
  entities as queueEntities,
  getJobSchemaOptions,
} from '@nest-boot/queue/persistence';
import { RequestContextModule } from '@nest-boot/request-context';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { Request, Response } from 'express';

import { GreetCommand } from './commands/greet.command.js';
import { createSessionContext } from './session-context.js';

/** 全局配置动态模块。 */
const ConfigDynamicModule = ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: process.env.NODE_ENV === 'testing' ? '.testing.env' : '.env',
  expandVariables: true,
});

const GraphQLDynamicModule = GraphQLModule.forRoot({
  context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
});

const DatabaseDynamicModule = DatabaseModule.forRoot({
  driver: PostgreSqlDriver,
  ...getJobSchemaOptions(),
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
    ConfigDynamicModule,
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
