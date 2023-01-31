import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";
import { PostController } from "./post.controller";

import { Post } from "./post.entity";
import { PostService } from "./post.service";

@Module({
  imports: [DatabaseModule.forFeature([Post])],
  providers: [PostService],
  controllers: [PostController],
})
export class PostModule {}
