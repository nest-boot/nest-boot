import { EntityManager } from "@mikro-orm/core";
import { ConnectionService, ID } from "@nest-boot/graphql";
import { NotFoundException } from "@nestjs/common";
import { Args, Query, Resolver } from "@nestjs/graphql";

import { PostConnection } from "./post.connection";
import { PostConnectionArgs } from "./post.connection-args";
import { Post } from "./post.entity";

@Resolver(Post)
export class PostResolver {
  constructor(
    private readonly em: EntityManager,
    private readonly connectionService: ConnectionService,
  ) {}

  @Query(() => Post)
  async post(@Args("id", { type: () => ID }) id: string): Promise<Post> {
    const post = await this.em.findOne(Post, { id });

    if (post === null) {
      throw new NotFoundException("Post not found");
    }

    return post;
  }

  @Query(() => PostConnection)
  async posts(@Args() args: PostConnectionArgs): Promise<PostConnection> {
    return await this.connectionService.get(Post, args);
  }
}
