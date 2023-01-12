import { Module } from "@nestjs/common";

import { UserAuthService } from "./user-auth.service";

@Module({ providers: [UserAuthService] })
export class UserAuthModule {}
