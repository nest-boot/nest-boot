import { Can } from "@nest-boot/common";
import { LessThan } from "@nest-boot/database";
import { QueryConnectionArgs } from "@nest-boot/graphql";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";

import { PostService } from "../../core/services/post.service";
import { CreatePostInput } from "../inputs/create-post.input";
import { UpdatePostInput } from "../inputs/update-post.input";
import { PostConnection } from "../objects/post-connection.object";
import { PostObject } from "../objects/post.object";

@Resolver(() => PostObject)
export class PostResolver {
  constructor(private readonly postService: PostService) {
    return this;
  }

  @Can("PUBLIC")
  @Query(() => PostObject)
  async post(@Args("id", { type: () => ID }) id: string): Promise<PostObject> {
    return await this.postService.findOne({ where: { id } });
  }

  @Can("PUBLIC")
  @Query(() => PostConnection)
  async posts(@Args() args: QueryConnectionArgs): Promise<PostConnection> {
    return await this.postService.getConnection(args);
  }

  @Can("PUBLIC")
  @Mutation(() => PostObject)
  async createPost(@Args("input") input: CreatePostInput): Promise<PostObject> {
    return await this.postService.create(input);
  }

  @Can("PUBLIC")
  @Mutation(() => PostObject)
  async updatePost(@Args("input") input: UpdatePostInput): Promise<PostObject> {
    const post = await this.postService.findOneById(input.id);

    Object.entries(input).forEach(([key, value]) => {
      post[key] = value;
    });

    return await this.postService.save(post);
  }
}
