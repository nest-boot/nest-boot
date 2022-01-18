import { EntityDataLoader } from "@nest-boot/database";
import { Injectable, Scope } from "@nestjs/common";

import { Post } from "../../core/entities/post.entity";
import { PostService } from "../../core/services/post.service";

@Injectable({ scope: Scope.REQUEST })
export class PostDataLoader extends EntityDataLoader<Post> {
  constructor(entityService: PostService) {
    super(entityService);
  }
}
