import { ConfigModule as NestConfigModule } from '@nestjs/config';

/** 全局配置动态模块。 */
export const ConfigModule = NestConfigModule.forRoot({
  isGlobal: true,
  envFilePath: process.env.NODE_ENV === 'testing' ? '.testing.env' : '.env',
  expandVariables: true,
});
