import { MikroORM } from "@mikro-orm/core";
import { Cron } from "@nest-boot/schedule";
import { Controller, Get } from "@nestjs/common";

import { User } from "./user.entity";
import { UserService } from "./user.service";

@Controller("/users")
export class UserController {
  constructor(
    private readonly orm: MikroORM,
    private readonly userService: UserService
  ) {}

  @Get("test")
  @Cron("*/5 * * * * *")
  async test(): Promise<User[]> {
    return await this.userService.repository.findAll();
  }
}
