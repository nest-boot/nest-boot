import { RequestContextModule } from "@nest-boot/request-context";
import { Module } from "@nestjs/common";

@Module({
  imports: [RequestContextModule],
})
export class AppModule {}
