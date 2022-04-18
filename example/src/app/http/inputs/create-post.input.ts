import { Length } from "@nest-boot/validator";
import { Field, InputType } from "@nestjs/graphql";

@InputType()
export class CreatePostInput {
  @Length(1, 255)
  @Field()
  title: string;

  @Field()
  markdown: string;
}
