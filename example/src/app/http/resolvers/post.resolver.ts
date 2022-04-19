import { Can } from "@nest-boot/common";
import { QueryConnectionArgs } from "@nest-boot/graphql";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";

import { PostRepository } from "../../core/repositories/post.repository";
import { CreatePostInput } from "../inputs/create-post.input";
import { UpdatePostInput } from "../inputs/update-post.input";
import { PostObject } from "../objects/post.object";
import { PostConnection } from "../objects/post-connection.object";
import {
  EntityManager,
  EntityRepository,
  InjectRepository,
} from "@nest-boot/database";
import { Post } from "../../core/entities/post.entity";

@Resolver(() => PostObject)
export class PostResolver {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly postRepository: PostRepository
  ) {}

  @Can("PUBLIC")
  @Query(() => PostObject)
  async post(@Args("id", { type: () => ID }) id: string): Promise<PostObject> {
    return await this.postRepository.findOne({ id });
  }

  // @Can("PUBLIC")
  // @Query(() => PostConnection)
  // async posts(@Args() args: QueryConnectionArgs): Promise<PostConnection> {
  //   return await this.postRepository.getConnection(args);
  // }

  @Can("PUBLIC")
  @Mutation(() => PostObject)
  async createPost(@Args("input") input: CreatePostInput): Promise<PostObject> {
    console.log(this.entityManager.getMetadata().get<Post>(Post.name).props[0]);

    const post = this.postRepository.create(input);

    await this.postRepository.persistAndFlush(post);

    return post;
  }

  @Can("PUBLIC")
  @Mutation(() => PostObject)
  async updatePost(@Args("input") input: UpdatePostInput): Promise<PostObject> {
    const post = await this.postRepository.findOne({ id: input.id });

    Object.entries(input).forEach(([key, value]) => {
      post[key] = value;
    });

    await this.postRepository.flush();

    return post;
  }
}
