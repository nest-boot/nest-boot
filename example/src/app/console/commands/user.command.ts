/* eslint-disable no-console */

import { Command, Positional } from "@nest-boot/command";
import { Injectable } from "@nestjs/common";
import crypto from "crypto";

import { UserService } from "../../core/services/user.service";

@Injectable()
export class UserCommand {
  constructor(private readonly userService: UserService) {}

  @Command({
    command: "create:user <name> <email>",
    describe: "创建一个用户",
  })
  async handle(
    @Positional({
      name: "name",
      describe: "名称",
      type: "string",
    })
    name: string,
    @Positional({
      name: "email",
      describe: "邮箱",
      type: "string",
    })
    email: string
  ): Promise<void> {
    const password = crypto.randomBytes(4).toString("hex");
    const user = this.userService.repository.create({ name, email, password });

    await this.userService.repository.persistAndFlush(user);

    console.log("创建用户成功");
    console.log("名称：", name);
    console.log("邮箱：", email);
    console.log("密码：", password);
  }
}
