import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { PersonalAccessToken } from "./personal-access-token.entity";
import { PersonalAccessTokenResolver } from "./personal-access-token.resolver";

@Module({
  imports: [DatabaseModule.forFeature([PersonalAccessToken])],
  providers: [PersonalAccessTokenResolver],
})
export class PersonalAccessTokenModule {}
