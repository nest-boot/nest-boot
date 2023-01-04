import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { UserController } from "./user.controller";
import { User } from "./user.entity";
import { UserService } from "./user.service";

@Module({
  imports: [DatabaseModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
