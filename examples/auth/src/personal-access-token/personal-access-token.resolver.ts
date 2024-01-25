import { EntityManager } from "@mikro-orm/core";
import { AuthService, CurrentUser } from "@nest-boot/auth";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { NotFoundException } from "@nestjs/common";
import {
  Args,
  Field,
  ID,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "@nestjs/graphql";

import { User } from "../user/user.entity";
import {
  PersonalAccessTokenConnection,
  PersonalAccessTokenConnectionArgs,
} from "./personal-access-token.connection-definition";
import { PersonalAccessToken } from "./personal-access-token.entity";

@ObjectType()
class CreatePersonalAccessTokenPayload {
  @Field()
  token!: string;

  @Field(() => PersonalAccessToken)
  personalAccessToken!: PersonalAccessToken;
}

@Resolver(() => PersonalAccessToken)
export class PersonalAccessTokenResolver {
  constructor(
    private readonly em: EntityManager,
    private readonly cm: ConnectionManager,
    private readonly authService: AuthService,
  ) {}

  @Query(() => PersonalAccessToken)
  async personalAccessToken(
    @CurrentUser() user: User,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<PersonalAccessToken> {
    const personalAccessToken = await this.em.findOne(PersonalAccessToken, {
      id,
      user,
    });

    if (personalAccessToken === null) {
      throw new NotFoundException("Personal access token not found.");
    }

    return personalAccessToken;
  }

  @Query(() => PersonalAccessTokenConnection)
  async personalAccessTokens(
    @CurrentUser() user: User,
    @Args() args: PersonalAccessTokenConnectionArgs,
  ): Promise<PersonalAccessTokenConnection> {
    return await this.cm.find(PersonalAccessTokenConnection, args, {
      where: { user },
    });
  }

  @Mutation(() => CreatePersonalAccessTokenPayload)
  async createPersonalAccessToken(
    @CurrentUser() user: User,
    @Args("name") name: string,
    @Args("permissions", { type: () => [String] }) permissions: string[],
  ): Promise<CreatePersonalAccessTokenPayload> {
    return await this.authService.createToken(user, name, permissions);
  }

  @Mutation(() => PersonalAccessToken)
  async deletePersonalAccessToken(
    @CurrentUser() user: User,
    @Args("id", { type: () => ID }) id: string,
  ): Promise<PersonalAccessToken> {
    const personalAccessToken = await this.em.findOne(PersonalAccessToken, {
      id,
      user,
    });

    if (personalAccessToken === null) {
      throw new NotFoundException("Personal access token not found.");
    }

    await this.authService.deleteToken(personalAccessToken);

    return personalAccessToken;
  }
}
