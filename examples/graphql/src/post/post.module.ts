import { DatabaseModule } from "@nest-boot/database";
import { Module } from "@nestjs/common";

import { Post } from "./post.entity";
import { PostResolver } from "./post.resolver";

DatabaseModule.registerEntity([Post]);

@Module({
  providers: [PostResolver],
})
export class PostModule {}
