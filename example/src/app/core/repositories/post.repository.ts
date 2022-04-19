import { mixinConnection } from "@nest-boot/graphql";
import { mixinSearchable } from "@nest-boot/search";
import { Injectable } from "@nestjs/common";
import { EntityRepository } from "@mikro-orm/core";

import { Post } from "../entities/post.entity";

export class PostRepository extends EntityRepository<Post> {}
