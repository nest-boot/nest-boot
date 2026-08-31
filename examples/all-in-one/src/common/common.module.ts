import { CryptModule } from '@nest-boot/crypt';
import { GraphQLModule } from '@nest-boot/graphql';
import { GraphQLConnectionModule } from '@nest-boot/graphql-connection';
import { LoggerModule } from '@nest-boot/logger';
import { MikroOrmModule } from '@nest-boot/mikro-orm';
import { RequestContextModule } from '@nest-boot/request-context';
import { RowLevelSecurityDriver } from '@nest-boot/row-level-security';
import { Global, Module } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ConfigModule } from './modules/config.module.js';
import { PermissionModule } from './modules/permission.module.js';

const GraphQLDynamicModule = GraphQLModule.forRoot({
  context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
});

const MikroORMDynamicModule = MikroOrmModule.forRoot({
  driver: RowLevelSecurityDriver,
});

/** 服务端公共基础设施模块。 */
@Global()
@Module({
  imports: [
    RequestContextModule,
    ConfigModule,
    MikroORMDynamicModule,
    GraphQLDynamicModule,
    GraphQLConnectionModule,
    LoggerModule,
    PermissionModule,
    CryptModule,
  ],
  exports: [PermissionModule],
})
export class CommonModule {}
