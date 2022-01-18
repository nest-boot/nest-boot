import { Field, InputType } from "@nestjs/graphql";

import { OrderDirection } from "../enums/order-direction.enum";

@InputType()
export class Ordering {
  @Field()
  field: string;

  @Field(() => OrderDirection)
  direction: OrderDirection;
}
