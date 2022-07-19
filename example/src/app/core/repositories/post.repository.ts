import { Repository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";

import { Post } from "../entities/post.entity";

@Repository(Post)
export class PostRepository extends EntityRepository<Post> {
  // your custom methods...
}
