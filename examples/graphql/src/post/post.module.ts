import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { PostResolver } from "./post.resolver";
import { Post } from "./post.entity";

@Module({
  imports: [DatabaseModule.forFeature([Post])],
  providers: [PostResolver],
})
export class PostModule {}
