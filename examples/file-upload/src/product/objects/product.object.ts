import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Product {
  @Field()
  name!: string;

  @Field()
  imageUrl!: string;

  @Field()
  description!: string;
}
