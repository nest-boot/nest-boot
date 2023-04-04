import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { PostController } from "./post.controller";
import { Post } from "./post.entity";
import { PostProcessor } from "./post.processor";
import { PostService } from "./post.service";

@Module({
  imports: [DatabaseModule.forFeature([Post])],
  providers: [PostService, PostProcessor],
  controllers: [PostController],
})
export class PostModule {}
