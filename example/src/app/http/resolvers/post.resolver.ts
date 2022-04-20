import { Can } from "@nest-boot/common";
import { QueryConnectionArgs } from "@nest-boot/graphql";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";

import { PostService } from "../../core/services/post.service";
import { CreatePostInput } from "../inputs/create-post.input";
import { UpdatePostInput } from "../inputs/update-post.input";
import { PostObject } from "../objects/post.object";
import { PostConnection } from "../objects/post-connection.object";
import { EntityManager } from "@mikro-orm/postgresql";
import { Post } from "../../core/entities/post.entity";

@Resolver(() => PostObject)
export class PostResolver {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly postService: PostService
  ) {}

  @Can("PUBLIC")
  @Query(() => PostObject)
  async post(@Args("id", { type: () => ID }) id: string): Promise<PostObject> {
    return await this.postService.repository.findOne({ id });
  }

  @Can("PUBLIC")
  @Query(() => PostConnection)
  async posts(@Args() args: QueryConnectionArgs): Promise<PostConnection> {
    return await this.postService.getConnection(args);
  }

  @Can("PUBLIC")
  @Mutation(() => PostObject)
  async createPost(@Args("input") input: CreatePostInput): Promise<PostObject> {
    console.log(this.entityManager.getMetadata().get<Post>(Post.name).props[0]);

    const post = this.postService.repository.create(input);

    await this.postService.repository.persistAndFlush(post);

    return post;
  }

  @Can("PUBLIC")
  @Mutation(() => PostObject)
  async updatePost(@Args("input") input: UpdatePostInput): Promise<PostObject> {
    const post = await this.postService.repository.findOne({ id: input.id });

    Object.entries(input).forEach(([key, value]) => {
      post[key] = value;
    });

    await this.postService.repository.flush();

    return post;
  }
}
