import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { Post } from "./post.entity";
import { PostService } from "./post.service";

@Module({
  imports: [DatabaseModule.forFeature([Post])],
  providers: [PostService],
})
export class PostModule {}
