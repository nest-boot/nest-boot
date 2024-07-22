import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { PersonalAccessToken } from "./personal-access-token.entity";
import { PersonalAccessTokenResolver } from "./personal-access-token.resolver";

DatabaseModule.registerEntity([PersonalAccessToken]);

@Module({
  providers: [PersonalAccessTokenResolver],
})
export class PersonalAccessTokenModule {}
