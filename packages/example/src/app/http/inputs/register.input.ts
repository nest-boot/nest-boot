import { IsEmail, IsUnique, Length } from "@nest-boot/validator";
import { Field, InputType } from "@nestjs/graphql";

import { User } from "../../core/entities/user.entity";

@InputType()
export class RegisterInput {
  @Field()
  name: string;

  @IsEmail()
  @IsUnique(() => User)
  @Field()
  email: string;

  @Length(6)
  @Field()
  password: string;
}
