import { Field, Int, ObjectType } from '@nest-boot/graphql';

import { User } from '../../user/user.entity.js';

/** One offset page of users visible to the caller. */
@ObjectType()
export class UserListType {
  /** Users in the current offset page. */
  @Field(() => [User])
  users!: User[];

  /** Total users matching the current search. */
  @Field(() => Int)
  total!: number;

  /** Maximum users requested for this page. */
  @Field(() => Int)
  limit!: number;

  /** Number of matching users skipped before this page. */
  @Field(() => Int)
  offset!: number;
}
