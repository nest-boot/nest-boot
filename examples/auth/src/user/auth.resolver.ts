import { AuthService, RequireAuth } from "@nest-boot/auth";
import { UnauthorizedException } from "@nestjs/common";
import { Args, Field, Mutation, ObjectType, Resolver } from "@nestjs/graphql";

import { PersonalAccessToken } from "../personal-access-token/personal-access-token.entity";
import { User } from "./user.entity";

@ObjectType()
class LoginPayload {
  @Field()
  token!: string;

  @Field(() => PersonalAccessToken)
  personalAccessToken!: PersonalAccessToken;
}

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @RequireAuth(false)
  @Mutation(() => LoginPayload)
  async login(
    @Args("email") email: string,
    @Args("password") password: string,
  ): Promise<LoginPayload> {
    const user = await this.authService.attempt(email, password);

    if (user === null) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    return await this.authService.createToken(user, "login", ["*"]);
  }

  @RequireAuth(false)
  @Mutation(() => User)
  async register(
    @Args("name") name: string,
    @Args("email") email: string,
    @Args("password") password: string,
  ): Promise<User> {
    return await this.authService.register(name, email, password);
  }
}
