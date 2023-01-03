import { MetricsModule } from "@nest-boot/metrics";
import { Module } from "@nestjs/common";

import { CommentModule } from "./comment/comment.module";
import { PostModule } from "./post/post.module";
import { UserModule } from "./user/user.module";
import { UserAuthModule } from "./user-auth/user-auth.module";

@Module({
  imports: [
    MetricsModule,
    UserModule,
    UserAuthModule,
    CommentModule,
    PostModule,
  ],
})
export class AppModule {}
