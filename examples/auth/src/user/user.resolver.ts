import { CurrentUser } from "@nest-boot/auth";
import { Query, Resolver } from "@nestjs/graphql";

import { User } from "./user.entity";

@Resolver(() => User)
export class UserResolver {
  @Query(() => User)
  me(@CurrentUser() user: User): User {
    return user;
  }
}
