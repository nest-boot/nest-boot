import { Field, InputType } from "@nestjs/graphql";

@InputType()
export class CreateAbsoluteFileInput {
  @Field()
  path!: string;
}
