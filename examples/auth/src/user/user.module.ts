import { Module } from "@nestjs/common";

import { AuthResolver } from "./auth.resolver";
import { UserResolver } from "./user.resolver";

@Module({
  providers: [UserResolver, AuthResolver],
})
export class UserModule {}
