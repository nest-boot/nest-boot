import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { PostController } from "./post.controller";
import { Post } from "./post.entity";

@Module({
  imports: [DatabaseModule.forFeature([Post])],
  controllers: [PostController],
})
export class PostModule {}
