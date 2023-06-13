import { Args, Complexity, ID, Query, Resolver } from "@nest-boot/graphql";

import { PostConnection } from "./post.connection";
import { type PostConnectionArgs } from "./post.connection-args";
import { Post } from "./post.entity";
import { PostService } from "./post.service";

@Resolver(() => Post)
export class PostResolver {
  constructor(private readonly postService: PostService) {}

  @Query(() => Post)
  async post(@Args("id", { type: () => ID }) id: string): Promise<Post> {
    return await this.postService.repository.findOneOrFail({ id });
  }

  @Complexity({ multipliers: ["first", "last"] })
  @Query(() => PostConnection, {
    complexity: ({ field }) => {
      console.log(field);
      return 10;
    },
  })
  async posts(@Args() args: PostConnectionArgs): Promise<PostConnection> {
    return await this.postService.getConnection(args);
  }
}
