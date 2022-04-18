import { AuthMiddleware } from "@nest-boot/auth";
import { ContextMiddleware, LoggerModule } from "@nest-boot/common";
import { TenantMiddleware } from "@nest-boot/tenant";
import { ApolloDriver } from "@nestjs/apollo";
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { GraphQLModule } from "@nestjs/graphql";

import { CoreModule } from "../core/core.module";
import { IndexController } from "./controllers/index.controller";
import { AuthGuard } from "./guards/auth.guard";
import { AuthResolver } from "./resolvers/auth.resolver";
import { PostResolver } from "./resolvers/post.resolver";

const resolvers = [AuthResolver, PostResolver];

@Module({
  imports: [
    CoreModule,
    LoggerModule,
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: true,
      path: "/graphql",
      context: ({ req, res }) => ({ req, res }),
    }),
  ],
  controllers: [IndexController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    ...resolvers,
  ],
})
export class HttpModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ContextMiddleware, TenantMiddleware, AuthMiddleware)
      .forRoutes("*");
  }
}
