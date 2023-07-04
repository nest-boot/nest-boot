import { EntityManager } from "@mikro-orm/postgresql";
import {
  Args,
  Complexity,
  ConnectionService,
  ID,
  Query,
  Resolver,
} from "@nest-boot/graphql";

import { PostConnection } from "./post.connection";
import { PostConnectionArgs } from "./post.connection-args";
import { Post } from "./post.entity";

@Resolver(() => Post)
export class PostResolver {
  constructor(
    private readonly em: EntityManager,
    private readonly connectionService: ConnectionService
  ) {}

  @Query(() => Post)
  async post(@Args("id", { type: () => ID }) id: string): Promise<Post> {
    return await this.em.findOneOrFail(Post, { id });
  }

  @Complexity({ multipliers: ["first", "last"] })
  @Query(() => PostConnection)
  async posts(@Args() args: PostConnectionArgs): Promise<PostConnection> {
    return this.connectionService.get(Post, args);
  }
}
