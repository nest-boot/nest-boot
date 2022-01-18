import { Can, getRuntimeContext } from "@nest-boot/common";
import { NotFoundException } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";

import { AuthService } from "../../core/services/auth.service";
import { UserService } from "../../core/services/user.service";
import { RegisterInput } from "../inputs/register.input";
import { UserObject } from "../objects/user.object";

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService
  ) {
    return this;
  }

  @Query(() => UserObject)
  async me(): Promise<UserObject> {
    return getRuntimeContext()?.user;
  }

  @Can("PUBLIC")
  @Mutation(() => String)
  async getToken(
    @Args("email") email: string,
    @Args("password") password: string
  ): Promise<string> {
    const user = await this.authService.attempt(email, password);

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    const personalAccessToken = await this.authService.createToken(user);

    const ctx = getRuntimeContext();
    ctx.res.cookie("access_token", personalAccessToken.token);
    return personalAccessToken?.token;
  }

  @Can("PUBLIC")
  @Mutation(() => UserObject)
  async register(@Args("input") input: RegisterInput): Promise<UserObject> {
    return await this.userService.create(input);
  }
}
