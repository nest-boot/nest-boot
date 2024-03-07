import { EntityManager } from "@mikro-orm/core";
import { ID } from "@nest-boot/graphql";
import { ConnectionManager } from "@nest-boot/graphql-connection";
import { NotFoundException } from "@nestjs/common";
import { Args, Query, Resolver } from "@nestjs/graphql";

import {
  PostConnection,
  PostConnectionArgs,
} from "./post.connection-definition";
import { Post } from "./post.entity";

@Resolver(Post)
export class PostResolver {
  constructor(
    private readonly em: EntityManager,
    private readonly cm: ConnectionManager,
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
    return await this.cm.find(PostConnection, args, {});
  }
}
