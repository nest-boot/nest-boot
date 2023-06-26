import { EntityManager } from "@mikro-orm/postgresql";
import { Args, Complexity, ID, Query, Resolver } from "@nest-boot/graphql";

import { PostConnection } from "./post.connection";
import { PostConnectionArgs } from "./post.connection-args";
import { Post } from "./post.entity";
import { PostService } from "./post.service";

@Resolver(() => Post)
export class PostResolver {
  constructor(
    private readonly postService: PostService,
    private readonly entityManager: EntityManager
  ) {}

  @Query(() => Post)
  async post(@Args("id", { type: () => ID }) id: string): Promise<Post> {
    return await this.entityManager.getRepository(Post).findOneOrFail({ id });
  }

  @Complexity({ multipliers: ["first", "last"] })
  @Query(() => PostConnection)
  async posts(@Args() args: PostConnectionArgs): Promise<PostConnection> {
    return await this.postService.getConnection(args);
  }
}
