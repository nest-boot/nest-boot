import { IsOptional, Length } from "@nest-boot/validator";
import { Field, ID, InputType } from "@nestjs/graphql";

@InputType()
export class UpdatePostInput {
  @Field(() => ID)
  id: string;

  @IsOptional()
  @Length(1, 255)
  @Field()
  title?: string;

  @Field()
  markdown?: string;
}
