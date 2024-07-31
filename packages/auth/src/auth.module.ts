import { RequestContextModule } from "@nest-boot/request-context";
import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";

import { AuthGuard } from "./auth.guard";
import { ConfigurableModuleClass } from "./auth.module-definition";
import { AuthService } from "./auth.service";

@Module({
  imports: [RequestContextModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    AuthService,
    Reflector,
  ],
  exports: [AuthService],
})
export class AuthModule extends ConfigurableModuleClass {}
