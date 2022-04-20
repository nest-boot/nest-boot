import { IsEmail, Length } from "@nest-boot/validator";
import { Field, InputType } from "@nestjs/graphql";

import { User } from "../../core/entities/user.entity";

@InputType()
export class RegisterInput {
  @Field()
  name: string;

  @IsEmail()
  @Field()
  email: string;

  @Length(6)
  @Field()
  password: string;
}
