import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { Post } from "./post.entity";
import { PostResolver } from "./post.resolver";

@Module({
  imports: [DatabaseModule.forFeature([Post])],
  providers: [PostResolver],
})
export class PostModule {}
