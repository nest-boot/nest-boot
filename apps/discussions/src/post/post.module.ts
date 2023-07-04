import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { Post } from "./post.entity";
import { PostProcessor } from "./post.processor";
import { PostResolver } from "./post.resolver";

@Module({
  imports: [DatabaseModule.forFeature([Post])],
  providers: [PostProcessor, PostResolver],
})
export class PostModule {}
