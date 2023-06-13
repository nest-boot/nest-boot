import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { Post } from "./post.entity";
import { PostProcessor } from "./post.processor";
import { PostResolver } from "./post.resolver";
import { PostService } from "./post.service";

@Module({
  imports: [DatabaseModule.forFeature([Post])],
  providers: [PostService, PostProcessor, PostResolver],
})
export class PostModule {}
