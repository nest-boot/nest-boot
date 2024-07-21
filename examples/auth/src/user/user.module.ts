import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { AuthResolver } from "./auth.resolver";
import { User } from "./user.entity";
import { UserResolver } from "./user.resolver";

DatabaseModule.registerEntity([User]);

@Module({
  providers: [UserResolver, AuthResolver],
})
export class UserModule {}
