import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { User } from "./user.entity";
import { UserService } from "./user.service";

@Module({
  imports: [DatabaseModule.forFeature([User])],
  providers: [UserService],
})
export class UserModule {}
