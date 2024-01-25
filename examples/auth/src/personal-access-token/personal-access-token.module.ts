import { Module } from "@nestjs/common";

import { PersonalAccessTokenResolver } from "./personal-access-token.resolver";

@Module({
  providers: [PersonalAccessTokenResolver],
})
export class PersonalAccessTokenModule {}
