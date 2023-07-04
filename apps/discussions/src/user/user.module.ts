import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { User } from "./user.entity";

@Module({
  imports: [DatabaseModule.forFeature([User])],
})
export class UserModule {}
